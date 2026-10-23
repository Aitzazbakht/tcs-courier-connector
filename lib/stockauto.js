// Automatic stock movements, run every night (and on demand from the Stock tab):
//  A) parcels booked on TCS since the start date are deducted (parts of each product + 1 flyer per parcel);
//  B) parcels TCS marks returned / cancelled are added back (never flyers, and never 10g boxes for parcels that travelled).
// Every CN is logged once in state.tcs, so a parcel is never deducted or added back twice.
import * as shop from "./shopify.js";
import { perStore } from "./sync.js";
import { rowsForRange, isoOf } from "./tools.js";
import { loadState, saveState } from "./stock.js";

const r1 = (n) => Math.round(n * 10) / 10;
const pkDay = (iso) => new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(0, 10);
const shift = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const has = (t, re) => re.test(t);
const size = (t, n) => new RegExp("(^|[^0-9.])" + n + "\\s*g\\b", "i").test(t);

// Shopify line item -> product id in the stock tracker (most specific rule first). null = can't map.
export function mapItem(title, variant) {
  const t = String(title || "") + " " + (variant && variant !== "Default Title" ? variant : "");
  if (has(t, /defence power bundle/i)) return "bundle-defence";
  if (has(t, /power bundle|60\s*g resin\s*\+\s*30\s*ml/i)) return "bundle-power";
  if (size(t, 60) && has(t, /10\s*g free/i)) return "offer-60-10";
  if (size(t, 30) && has(t, /10\s*g free/i)) return "offer-30-10";
  if (has(t, /gummies/i)) return has(t, /60/) ? "gummies-60" : has(t, /40/) ? "gummies-40" : null;
  if (has(t, /honey shilajit|honey/i)) return has(t, /30\s*sachets?/i) ? "honey-30" : has(t, /15\s*sachets?/i) ? "honey-15" : null;
  if (has(t, /drops|30\s*ml/i)) return "drops-30";
  if (size(t, 10)) return "resin-10g";
  if (size(t, 20)) return "resin-20g";
  if (size(t, 30)) return "resin-30g";
  if (size(t, 60) || has(t, /3 months course/i)) return "resin-60g";
  return null;
}

// A whole order line -> { product, qty } to deduct, "ignore" (a discontinued product we no longer stock), or null (can't tell).
// Loose honey sachets ("Honey Shilajit Sachets (6 pcs)") are deducted one sachet at a time.
export function mapLine(title, variant, quantity) {
  const t = String(title || "") + " " + (variant && variant !== "Default Title" ? variant : "");
  const q = Number(quantity) || 0;
  if (/capsule/i.test(t)) return "ignore";
  const p = mapItem(title, variant);
  if (p) return { product: p, qty: q };
  const m = /honey/i.test(t) && /(\d+)\s*(pcs|pieces|sachets?)/i.exec(t);
  if (m) return { product: "honey-loose", qty: Number(m[1]) * q };
  return null;
}

const ORDERS_Q = `query O($q: String!, $after: String) { orders(first: 100, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) {
  pageInfo { hasNextPage endCursor }
  nodes { name tags cancelledAt fulfillments(first: 5) { createdAt } lineItems(first: 30) { nodes { title quantity variantTitle } } } } }`;

async function bookedOrders(sinceDay) {
  const { rows, errors } = await perStore(async () => {
    const out = []; let after = null;
    for (let i = 0; i < 30; i++) {
      const d = await shop.gql(ORDERS_Q, { q: `tag:tcs-booked created_at:>=${sinceDay}`, after });
      out.push(...d.orders.nodes);
      if (!d.orders.pageInfo.hasNextPage) break;
      after = d.orders.pageInfo.endCursor;
    }
    return out;
  });
  const list = rows.map((o) => {
    const cn = (o.tags || []).map((t) => /^TCS-(\d{6,})$/i.exec(t)?.[1]).find(Boolean) || null;
    const f = (o.fulfillments || []).map((x) => x.createdAt).sort()[0] || null;
    const items = {}; const unmapped = []; let ignored = 0;
    for (const l of o.lineItems.nodes) {
      const m = mapLine(l.title, l.variantTitle, l.quantity);
      if (m === "ignore") ignored++;
      else if (m) items[m.product] = (items[m.product] || 0) + m.qty;
      else unmapped.push(l.title);
    }
    return { order: o.name, cn, store: o.store, cancelled: !!o.cancelledAt, bookedDay: f ? pkDay(f) : null, items, unmapped, ignored };
  });
  return { list, errors };
}

function deltaOf(prods, items, { flyers, skip = [] }) {
  const d = {};
  for (const [p, q] of Object.entries(items)) for (const [c, k] of Object.entries(prods[p]?.bom || {})) if (!skip.includes(c)) d[c] = (d[c] || 0) + k * q;
  if (flyers) d["resin-flyer"] = (d["resin-flyer"] || 0) - flyers;
  return d;
}
const chName = (store) => (store === "herbs" || store === "HERBS" ? "Chitral Herbs" : "Chitral House");

export async function runAuto({ now = Date.now() } = {}) {
  const s = await loadState();
  const auto = s.auto || { startDate: null, returnsFrom: null };
  const out = { deducted: [], returned: [], unmapped: [], notFound: [], warnings: [], at: new Date(now).toISOString() };
  if (!auto.startDate) { out.warnings.push("Auto-deduction has no start date yet."); return out; }
  const today = pkDay(new Date(now).toISOString());
  s.tcs = s.tcs || {};
  const stamp = new Date(now + 5 * 3600e3).toISOString().replace(/[-:T]/g, "").slice(0, 12);

  // ---- A) bookings ----
  const { list, errors } = await bookedOrders(shift(today, -14));
  for (const e of errors) out.warnings.push("Couldn't read " + e.store + ": " + e.error);
  const fresh = list.filter((o) => o.cn && !s.tcs[o.cn] && o.bookedDay && o.bookedDay >= auto.startDate && o.bookedDay <= today);
  const groups = new Map();
  for (const o of fresh) {
    if (o.cancelled) continue;
    if (!o.unmapped.length && !Object.keys(o.items).length && o.ignored) { s.tcs[o.cn] = { order: o.order, store: o.store, items: {}, booked: o.bookedDay, ret: false, ignored: true }; continue; }
    if (o.unmapped.length || !Object.keys(o.items).length) { out.unmapped.push({ order: o.order, cn: o.cn, title: o.unmapped.join(", ") || "no items" }); continue; }
    const k = o.bookedDay + "|" + o.store;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  }
  for (const [k, os] of groups) {
    const [day, store] = k.split("|");
    const items = {}; os.forEach((o) => Object.entries(o.items).forEach(([p, q]) => { items[p] = (items[p] || 0) + q; }));
    const parts = deltaOf(s.prods, items, { flyers: 0 }); const d2 = {};
    for (const [c, v] of Object.entries(parts)) d2[c] = r1(-v);
    d2["resin-flyer"] = (d2["resin-flyer"] || 0) - os.length;
    s.moves.push({ id: "auto-book-" + day + "-" + (store === "herbs" ? "herbs" : "ch") + "-" + stamp, at: new Date(now).toISOString(), day, type: "dispatch", channel: chName(store), note: "Auto: booked on TCS " + day + ", " + os.length + " parcels (orders " + os.map((o) => o.order).join(", ") + ")", items, parcels: os.length, delta: d2, by: "auto" });
    for (const o of os) s.tcs[o.cn] = { order: o.order, store, items: o.items, booked: day, ret: false };
    out.deducted.push({ day, store: chName(store), parcels: os.length, items });
  }

  // ---- B) returns / cancellations ----
  let rows = [];
  try { rows = await rowsForRange(shift(today, -45), today); } catch (e) { out.warnings.push("Couldn't read TCS returns: " + e.message); }
  const back = rows.filter((r) => ["RO", "RS", "CN"].includes(r.status_code) && r.cn && !(s.tcs[r.cn] && s.tcs[r.cn].ret));
  let lookup = null;
  const rgroups = new Map();
  for (const r of back) {
    const day = isoOf(r.delivered);
    if (!day || (auto.returnsFrom && day < auto.returnsFrom)) continue;
    let rec = s.tcs[r.cn];
    if (!rec) {
      if (!lookup) lookup = (await bookedOrders(shift(today, -60))).list;
      const o = lookup.find((x) => x.cn === String(r.cn)) || lookup.find((x) => String(r.order || "").replace(/^#/, "") === String(x.order).replace(/^#/, ""));
      if (o && !o.unmapped.length && !Object.keys(o.items).length && o.ignored) { s.tcs[r.cn] = { order: o.order, store: o.store, items: {}, booked: o.bookedDay || "", ret: true, retDay: day, ignored: true }; continue; }
      if (!o || o.unmapped.length || !Object.keys(o.items).length) { out.notFound.push({ cn: r.cn, order: r.order }); continue; }
      rec = s.tcs[r.cn] = { order: o.order, store: o.store, items: o.items, booked: o.bookedDay || "", ret: false };
    }
    const k = day + "|" + rec.store + "|" + (r.status_code === "CN" ? "cancel" : "travelled");
    if (!rgroups.has(k)) rgroups.set(k, []);
    rgroups.get(k).push({ r, rec });
  }
  for (const [k, list2] of rgroups) {
    const [day, store, kind] = k.split("|");
    const items = {}; list2.forEach(({ rec }) => Object.entries(rec.items).forEach(([p, q]) => { items[p] = (items[p] || 0) + q; }));
    const parts = deltaOf(s.prods, items, { flyers: 0, skip: ["resin-flyer"].concat(kind === "travelled" ? ["resin-box-10"] : []) });
    const d2 = {}; for (const [c, v] of Object.entries(parts)) if (v) d2[c] = r1(v);
    if (!Object.keys(d2).length) { for (const { r, rec } of list2) { rec.ret = true; rec.retDay = day; s.tcs[r.cn] = rec; } continue; }
    s.moves.push({ id: "auto-ret-" + day + "-" + (store === "herbs" ? "herbs" : "ch") + "-" + kind + "-" + stamp, at: new Date(now).toISOString(), day, type: "return", channel: chName(store), note: "Auto: " + (kind === "cancel" ? "cancelled" : "returned by TCS") + " " + day + ", " + list2.length + " parcels (orders " + list2.map((x) => x.rec.order).join(", ") + ")" + (kind === "travelled" ? "; 10g boxes and flyers not added back" : "; flyers not added back"), items, parcels: list2.length, delta: d2, by: "auto" });
    for (const { r, rec } of list2) { rec.ret = true; rec.retDay = day; s.tcs[r.cn] = rec; }
    out.returned.push({ day, store: chName(store), parcels: list2.length, items, kind });
  }

  // keep the CN log small
  const cut = shift(today, -90);
  for (const [cn, rec] of Object.entries(s.tcs)) if (rec.booked && rec.booked < cut) delete s.tcs[cn];
  s.autoLog = (s.autoLog || []).concat([{ at: out.at, deducted: out.deducted.reduce((t, x) => t + x.parcels, 0), returned: out.returned.reduce((t, x) => t + x.parcels, 0), unmapped: out.unmapped.length, notFound: out.notFound.length, unmappedList: out.unmapped.slice(0, 20), notFoundList: out.notFound.slice(0, 20), warnings: out.warnings }]).slice(-20);
  await saveState(s);
  return out;
}
