// "Daily Sales & Profit Report" for the Setup tab.
// Orders of one Pakistan day (both Shopify stores) are matched to the TCS parcels booked on the shipped day
// (normally the next day), costed per product, and turned into a profit and loss.
// TCS gives no phone numbers, so parcels are matched by CN number (order tag / fulfillment) and by the order
// number TCS keeps as "customer ref". Both are exact; names or phones would only be guesses.
import * as shop from "./shopify.js";
import * as tcs from "./tcs.js";
import { perStore } from "./sync.js";
import { pkWindow, trackAll } from "./daily.js";
import { bucketOf, isoOf } from "./tools.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const DELIVERY_PER_PARCEL = 250;
export const FEE_PCT = 4;

export const PRODUCTS = {
  r10: { label: "10g Resin", cost: 300, units: 1 },
  r20: { label: "20g Resin", cost: 560, units: 1 },
  r30: { label: "30g Resin", cost: 700, units: 1 },
  r60: { label: "60g Resin", cost: 1130, units: 1 },
  r60f: { label: "60g + 10g free", cost: 1430, units: 2 },
  drops: { label: "Drops 30ml", cost: 650, units: 1 },
  g40: { label: "Gummies 40", cost: 440, units: 1 },
  g60: { label: "Gummies 60", cost: 620, units: 1 },
  h15: { label: "Honey 15 sachets", cost: 460, units: 1 },
  h30: { label: "Honey 30 sachets", cost: 820, units: 1 },
  combo: { label: "3-in-1 Combo / Defence Power Bundle", cost: 1780, units: 1 },
  loose: { label: "Loose sachets", cost: 31, units: 1 }, // per sachet
  other: { label: "Other / not in cost list", cost: 0, units: 1 },
};

export const AD_ACCOUNTS = [
  ["metaHouse", "Meta: Chitral House (Myadaccount)"],
  ["metaHerbs", "Meta: Chitral Herbs (Not use)"],
  ["tiktokHouse", "TikTok: Chitral House SMC PVT LTD1119"],
  ["tiktokNew", "TikTok: CHouse new"],
  ["google", "Google Ads (790-385-1046)"],
  ["otherMeta", "Other Chitral Meta accounts (expected 0)"],
];

const SOURCE_LABEL = { house: "Chitral House", whatsapp: "WhatsApp", herbs: "Chitral Herbs", other: "Other (no order found)" };
const SOURCE_ORDER = ["house", "whatsapp", "herbs", "other"];

const clean = (s) => String(s || "").trim();
const money = (n) => Math.round(Number(n) || 0);
const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const digits = (s) => String(s || "").replace(/\D/g, "");

// Map a Shopify line item to a cost-list product. `mult` multiplies the quantity (loose sachets are sold as "6 pcs").
export function classify(title, variant) {
  const v = clean(variant);
  const t = (String(title || "") + " " + (v && v !== "Default Title" ? v : "")).toLowerCase();
  if (/defen[cs]e power|3\s*-?\s*in\s*-?\s*1|combo/.test(t)) return { key: "combo", mult: 1 };
  if (/\b60\s*g\b/.test(t) && /free/.test(t)) return { key: "r60f", mult: 1 };
  if (/honey|sachet/.test(t)) {
    const pcs = /\b(\d+)\s*(pcs|pc|pieces)\b/.exec(t);
    if (pcs) return { key: "loose", mult: Number(pcs[1]) };
    if (/\b30\b/.test(t)) return { key: "h30", mult: 1 };
    if (/\b15\b/.test(t)) return { key: "h15", mult: 1 };
    return { key: "other", mult: 1 };
  }
  if (/gumm/.test(t)) {
    if (/\b60\b/.test(t)) return { key: "g60", mult: 1 };
    if (/\b40\b/.test(t)) return { key: "g40", mult: 1 };
    return { key: "other", mult: 1 };
  }
  if (/drops|\b30\s*ml\b/.test(t)) return { key: "drops", mult: 1 };
  const w = /\b(10|20|30|60)\s*g\b/.exec(t);
  if (w) return { key: "r" + w[1], mult: 1 };
  return { key: "other", mult: 1 };
}

// ---------- Shopify ----------
const FIELDS = `name createdAt sourceName tags note cancelledAt phone paymentGatewayNames
  totalPriceSet { shopMoney { amount } }
  shippingAddress { name phone city }
  fulfillments(first: 5) { trackingInfo { number } }
  lineItems(first: 30) { nodes { title variantTitle quantity originalUnitPriceSet { shopMoney { amount } } } }`;

async function listDay(startIso, endIso) {
  const out = [];
  let after = null;
  for (let i = 0; i < 40; i++) {
    const d = await shop.gql(
      `query P($q: String!, $after: String) { orders(first: 100, after: $after, query: $q, sortKey: CREATED_AT) {
        pageInfo { hasNextPage endCursor } nodes { ${FIELDS} } } }`,
      { q: `created_at:>='${startIso}' AND created_at:<'${endIso}'`, after }
    );
    out.push(...d.orders.nodes);
    if (!d.orders.pageInfo.hasNextPage) break;
    after = d.orders.pageInfo.endCursor;
  }
  return out;
}

export function normOrder(o) {
  const tags = o.tags || [];
  const cn = tags.map((t) => /^TCS-(\d{6,})$/i.exec(t)?.[1]).find(Boolean)
    || (o.fulfillments || []).flatMap((f) => f.trackingInfo || []).map((t) => (/^\d{6,}$/.test(clean(t.number)) ? clean(t.number) : null)).find(Boolean) || null;
  const lines = (o.lineItems?.nodes || []).map((li) => {
    const c = classify(li.title, li.variantTitle);
    const p = PRODUCTS[c.key];
    const qty = Number(li.quantity) || 0;
    return {
      key: c.key, label: p.label, title: clean(li.title), qty: qty * c.mult,
      units: p.units * qty * c.mult, cost: p.cost * qty * c.mult,
      list: money(li.originalUnitPriceSet?.shopMoney?.amount) * qty,
    };
  });
  const total = money(o.totalPriceSet?.shopMoney?.amount);
  const listTotal = lines.reduce((s, l) => s + l.list, 0);
  const chat = o.store === "house" && shop.isChatOrder(o);
  return {
    name: o.name, num: digits(o.name), createdAt: o.createdAt, store: o.store, tags, cn,
    source: o.store === "herbs" ? "herbs" : chat ? "whatsapp" : "house",
    cancelled: !!o.cancelledAt || tags.some((t) => /^fake-order$/i.test(t)),
    cancelReason: o.cancelledAt ? "cancelled" : tags.some((t) => /^fake-order$/i.test(t)) ? "fake order" : "",
    customer: clean(o.shippingAddress?.name), city: clean(o.shippingAddress?.city),
    phone10: last10(o.shippingAddress?.phone || o.phone),
    total, listTotal, lines,
    prepaidTag: tags.some((t) => /^COD-0$/i.test(t)),
  };
}

// Older orders that a parcel points to (customer ref) but that were placed on another day.
async function lookupOlder(refs, deadline) {
  const out = new Map();
  const queue = [...refs];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length && Date.now() < deadline) {
      const ref = queue.shift();
      try {
        const { rows } = await perStore(async () => {
          const d = await shop.gql(`query L($q: String!) { orders(first: 5, query: $q) { nodes { ${FIELDS} } } }`, { q: "name:" + ref });
          return d.orders.nodes.filter((n) => digits(n.name) === ref);
        });
        if (rows.length === 1) out.set(ref, normOrder(rows[0]));
        else if (rows.length > 1) out.set(ref, { ambiguous: true });
      } catch { /* leave the parcel unmatched */ }
    }
  }));
  return { map: out, skipped: queue.length };
}

// ---------- TCS ----------
async function fetchParcels(ship) {
  const d = await tcs.bulkInquiry(ship, ship);
  const list = Array.isArray(d?.detail) ? d.detail : null;
  if (!list) throw new Error(`TCS returned no parcel list for ${ship}: ${String(d?.MESSAGE || d?.message || "no detail in response").slice(0, 200)}`);
  const seen = new Set();
  const out = [];
  for (const r of list) {
    const cn = String(r.cnno);
    if (seen.has(cn)) continue;
    seen.add(cn);
    out.push({
      cn, ref: digits(r.customerrefno), booked: isoOf(r.bookingdate), cod: money(r.codamount),
      code: String(r.cnstatus || "").trim().toUpperCase(), city: clean(r.destinationcode), deliveredOn: isoOf(r.deliverydate),
    });
  }
  return out;
}

function classifyParcel(p, t) {
  const b = bucketOf(p.code);
  if (b === "cancelled") return { g: "cancelled", state: "Cancelled" };
  if (b === "delivered") return { g: "delivered", state: "Delivered" };
  if (b === "returned") return { g: "notDelivered", state: t?.valid && t.state ? t.state : "Returned to sender" };
  if (t?.valid) {
    if (t.group === "delivered") return { g: "delivered", state: t.state || "Delivered" };
    if (t.group === "returned") return { g: "notDelivered", state: t.state || "Refused / returned" };
    return { g: "inProcess", state: t.state || "In process" };
  }
  return { g: "inProcess", state: t?.failed ? "Status lookup failed" : "In process" };
}

// ---------- Matching and maths (pure, easy to test) ----------
// Sales of an order: the order total; a free (zero) order counts at list price; with neither, the TCS COD value.
function orderSales(o, parcel) {
  let sales = o.total, flag = "";
  if (o.total <= 0) {
    if (o.listTotal > 0) { sales = o.listTotal; flag = `Zero-amount order, counted at list price Rs ${o.listTotal}`; }
    else if (parcel && parcel.cod > 0) { sales = parcel.cod; flag = `No amount on the order, used TCS COD Rs ${parcel.cod}`; }
    else flag = "No amount on the order and no COD, counted as 0";
  } else if (o.prepaidTag || (parcel && parcel.cod === 0)) {
    flag = `Prepaid (COD 0), counted at the order total Rs ${o.total}`;
  }
  return { sales, flag };
}

const productText = (o) => o.lines.map((l) => (l.qty > 1 ? l.qty + " x " : "") + l.label).join(", ") || "no items";

export function matchParcels(orders, parcels) {
  const byCn = new Map();
  const byNum = new Map();
  for (const o of orders) {
    if (o.cn) byCn.set(o.cn, o);
    if (!byNum.has(o.num)) byNum.set(o.num, []);
    byNum.get(o.num).push(o);
  }
  const matched = new Map(); // order -> parcel
  const unmatched = [];
  for (const p of parcels) {
    let o = byCn.get(p.cn);
    if (!o && p.ref) { const c = (byNum.get(p.ref) || []).filter((x) => !matched.has(x)); if (c.length === 1) o = c[0]; }
    if (o && !matched.has(o)) matched.set(o, p); else unmatched.push(p);
  }
  return { matched, unmatched };
}

export function buildReport({ date, ship, orders, excluded, parcels, track, older, ads, warnings = [] }) {
  const { matched, unmatched } = matchParcels(orders, parcels);
  const parcelOrder = new Map([...matched].map(([o, p]) => [p.cn, o]));

  // Same customer twice (e.g. a manual WhatsApp order and the website order): count once. An order that has its own TCS parcel is never dropped.
  const baseSales = (o) => (o.total > 0 ? o.total : o.listTotal);
  const groups = new Map();
  const live = [];
  for (const o of orders) {
    if (!o.phone10) { live.push(o); continue; }
    const k = o.store + "|" + o.phone10 + "|" + baseSales(o);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  }
  const duplicates = [];
  for (const g of groups.values()) {
    g.sort((a, b) => (Number(matched.has(b)) - Number(matched.has(a))) || (Number(!!b.cn) - Number(!!a.cn)) || a.createdAt.localeCompare(b.createdAt));
    live.push(g[0]);
    for (const o of g.slice(1)) {
      if (matched.has(o)) live.push(o);
      else duplicates.push({ order: o.name, kept: g[0].name, customer: o.customer, sales: baseSales(o) });
    }
  }
  live.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Per order: sales, cost, units
  const flagged = [], mismatches = [];
  for (const o of live) {
    const p = matched.get(o) || null;
    const { sales, flag } = orderSales(o, p);
    o.sales = sales;
    o.cost = o.lines.reduce((s, l) => s + l.cost, 0);
    o.units = o.lines.reduce((s, l) => s + l.units, 0);
    if (flag) flagged.push({ order: o.name, customer: o.customer, note: flag });
    if (p && p.cod > 0 && !flag && p.cod !== sales) mismatches.push({ order: o.name, cn: p.cn, cod: p.cod, orderTotal: sales });
  }

  // Booked side
  const bookedSales = live.reduce((s, o) => s + o.sales, 0);
  const bySource = new Map();
  const bump = (m, key, f) => { if (!m.has(key)) m.set(key, f()); return m.get(key); };
  for (const o of live) {
    const r = bump(bySource, o.source, () => ({ key: o.source, label: SOURCE_LABEL[o.source] || o.source, orders: 0, units: 0, sales: 0, cost: 0 }));
    r.orders++; r.units += o.units; r.sales += o.sales; r.cost += o.cost;
  }
  const sources = SOURCE_ORDER.filter((k) => bySource.has(k)).map((k) => bySource.get(k));
  const sourcesTotal = sources.reduce((t, r) => ({ orders: t.orders + r.orders, units: t.units + r.units, sales: t.sales + r.sales, cost: t.cost + r.cost }), { orders: 0, units: 0, sales: 0, cost: 0 });

  // Product-wise sales: an order's sales are shared between its lines by list price, so the table adds up to booked sales
  const byProduct = new Map();
  for (const o of live) {
    const seen = new Set();
    const basis = o.lines.reduce((s, l) => s + l.list, 0) || o.lines.reduce((s, l) => s + l.units, 0) || 1;
    for (const l of o.lines) {
      const r = bump(byProduct, l.key, () => ({ key: l.key, label: l.label, orders: 0, units: 0, sales: 0, cost: 0 }));
      if (!seen.has(l.key)) { r.orders++; seen.add(l.key); }
      r.units += l.units; r.cost += l.cost;
      r.sales += o.sales * ((o.lines.reduce((s, x) => s + x.list, 0) ? l.list : l.units) / basis);
    }
  }
  const products = [...byProduct.values()].sort((a, b) => b.sales - a.sales)
    .map((r) => ({ ...r, sales: Math.round(r.sales), share: bookedSales ? +((100 * r.sales) / bookedSales).toFixed(1) : 0 }));

  // Parcels (shipped side)
  const parcelRows = [];
  const cancelledParcels = [];
  for (const p of parcels) {
    const t = track.get(p.cn) || null;
    const c = classifyParcel(p, t);
    if (c.g === "cancelled") { cancelledParcels.push(p); continue; }
    let o = matched.has(parcelOrder.get(p.cn)) ? parcelOrder.get(p.cn) : null;
    let from = "this day";
    let sales, cost, units, source, customer, product, note = "";
    if (o) {
      sales = o.sales; cost = o.cost; units = o.units; source = o.source; customer = o.customer; product = productText(o);
    } else {
      const lo = p.ref ? older.get(p.ref) : null;
      if (lo && !lo.ambiguous) {
        const s = orderSales(lo, p);
        o = lo; from = "earlier order " + lo.name;
        sales = s.sales; cost = lo.lines.reduce((x, l) => x + l.cost, 0); units = lo.lines.reduce((x, l) => x + l.units, 0);
        source = lo.source; customer = lo.customer; product = productText(lo);
        if (lo.lines.some((l) => l.key === "other")) note = "some items not in the cost list";
      } else {
        from = "no order found";
        sales = p.cod; cost = 0; units = 0; source = "other"; customer = "CN " + p.cn; product = "unknown (no matching order)";
        note = p.ref ? "order " + p.ref + " not found in either store, product cost not counted" : "no order number on the parcel, product cost not counted";
      }
    }
    parcelRows.push({ cn: p.cn, ref: p.ref, g: c.g, state: c.state, sales, cost, units, source, customer, product, cod: p.cod, city: p.city, order: o ? o.name : null, from, matchedToday: from === "this day", note });
  }

  const feeRate = FEE_PCT / 100;
  const sum = (rows, f) => rows.reduce((s, r) => s + f(r), 0);
  const delivered = parcelRows.filter((r) => r.g === "delivered");
  const inProcess = parcelRows.filter((r) => r.g === "inProcess");
  const notDelivered = parcelRows.filter((r) => r.g === "notDelivered");
  const shipped = parcelRows.length;
  const deliveredSales = sum(delivered, (r) => r.sales);
  const productCost = sum(delivered, (r) => r.cost);
  const delivery = shipped * DELIVERY_PER_PARCEL;
  const adRows = AD_ACCOUNTS.map(([k, label]) => ({ key: k, label, amount: Math.max(0, money(ads?.[k])) }));
  const adSpend = sum(adRows, (r) => r.amount);
  const fee = Math.round(deliveredSales * feeRate);
  const net = deliveredSales - productCost - delivery - adSpend - fee;
  const extra = (rows) => Math.round(sum(rows, (r) => r.sales * (1 - feeRate) - r.cost));
  const inExtra = extra(inProcess), ndExtra = extra(notDelivered);

  const tcsBySource = new Map();
  for (const r of parcelRows) {
    const s = bump(tcsBySource, r.source, () => ({ key: r.source, label: SOURCE_LABEL[r.source] || r.source, shipped: 0, delivered: 0, inProcess: 0, notDelivered: 0, deliveredSales: 0 }));
    s.shipped++; s[r.g]++; if (r.g === "delivered") s.deliveredSales += r.sales;
  }
  const rate = (d, s) => (s ? +((100 * d) / s).toFixed(1) : null);
  const tcsRows = SOURCE_ORDER.filter((k) => tcsBySource.has(k)).map((k) => tcsBySource.get(k)).map((r) => ({ ...r, rate: rate(r.delivered, r.shipped) }));
  const tcsTotal = { shipped, delivered: delivered.length, inProcess: inProcess.length, notDelivered: notDelivered.length, deliveredSales, rate: rate(delivered.length, shipped) };

  const listOf = (rows) => rows.map((r) => ({ customer: r.customer, product: r.product, cod: r.cod || r.sales, sales: r.sales, status: r.state, order: r.order, cn: r.cn, note: r.note }));

  // Notes
  const notShipped = live.filter((o) => !matched.has(o)).map((o) => ({
    order: o.name, customer: o.customer, sales: o.sales || baseSales(o),
    note: o.cn ? "has TCS number " + o.cn + " but it was not booked on " + ship : "no TCS parcel",
  }));
  const unmatchedList = parcelRows.filter((r) => !r.matchedToday).map((r) => ({
    cn: r.cn, ref: r.ref, customer: r.customer, product: r.product, sales: r.sales, status: r.state, counts: r.g, source: r.source, from: r.from, note: r.note,
  }));
  const unmapped = [];
  for (const o of live) for (const l of o.lines) if (l.key === "other") unmapped.push({ order: o.name, title: l.title });
  const byPhone = new Map();
  for (const o of live) if (o.phone10) { if (!byPhone.has(o.phone10)) byPhone.set(o.phone10, []); byPhone.get(o.phone10).push(o); }
  const repeat = [...byPhone.values()].filter((g) => g.length > 1).map((g) => ({ customer: g[0].customer, orders: g.map((o) => o.name) }));

  if (!parcels.length) warnings.push(`TCS has no parcels booked on ${ship}. Check the shipped date.`);

  return {
    date, ship, generatedAt: new Date().toISOString(), warnings,
    kpi: { orders: live.length, bookedSales, shipped, delivered: delivered.length, deliveredSales, net },
    sources, sourcesTotal, products,
    ads: { rows: adRows, total: adSpend },
    pnl: {
      deliveredSales, productCost, shipped, deliveryPer: DELIVERY_PER_PARCEL, delivery, adSpend, feePct: FEE_PCT, fee, net,
      marginPct: deliveredSales ? +((100 * net) / deliveredSales).toFixed(1) : null,
      inProcessCount: inProcess.length, inProcessExtra: inExtra, profitIfInProcess: net + inExtra,
      notDeliveredCount: notDelivered.length, notDeliveredExtra: ndExtra, profitAllDelivered: net + inExtra + ndExtra,
    },
    tcs: { rows: tcsRows, total: tcsTotal },
    notDelivered: { rows: listOf(notDelivered), total: sum(notDelivered, (r) => r.cod || r.sales) },
    inProcess: { rows: listOf(inProcess), total: sum(inProcess, (r) => r.cod || r.sales) },
    notes: {
      unmatched: unmatchedList, notShipped, flagged, mismatches, duplicates, repeat, unmapped,
      excluded: excluded.map((o) => ({ order: o.name, customer: o.customer, sales: o.total, reason: o.cancelReason })),
      cancelledParcels: cancelledParcels.map((p) => ({ cn: p.cn, ref: p.ref, cod: p.cod })),
      costUnknown: parcelRows.filter((r) => r.source === "other" && !r.order).length,
    },
    assumptions: {
      costs: Object.entries(PRODUCTS).filter(([k]) => k !== "other").map(([k, p]) => ({ label: p.label, cost: p.cost, units: p.units })),
      deliveryPer: DELIVERY_PER_PARCEL, feePct: FEE_PCT,
    },
  };
}

export async function profitReport({ date, ship, ads = {}, refresh = false } = {}) {
  if (!ISO.test(date || "")) throw new Error("Pick a valid order date.");
  const day = 86400000;
  if (!ISO.test(ship || "")) ship = new Date(Date.parse(date + "T00:00:00Z") + day).toISOString().slice(0, 10);
  if (ship < date) throw new Error("The shipped date can't be before the order date.");
  if ((Date.parse(ship) - Date.parse(date)) / day > 14) throw new Error("The shipped date is more than 14 days after the order date.");
  const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  if (date > today) throw new Error("That order date is in the future.");
  const deadline = Date.now() + 52000;
  const warnings = [];
  if (ship >= today) warnings.push(`The shipped date ${ship} is today or later, so some parcels may not be booked yet.`);

  // 1. Orders of the day from both stores. A missing store would make the report wrong, so any failure stops it.
  const win = pkWindow(date);
  const { rows: raw, errors } = await perStore(async () => listDay(win.start, win.end));
  if (errors.length) throw new Error("Couldn't read orders: " + errors.map((e) => `${e.store} (${e.error})`).join("; "));
  const all = raw.map(normOrder);
  const orders = all.filter((o) => !o.cancelled);
  const excluded = all.filter((o) => o.cancelled);

  // 2. TCS parcels booked on the shipped day, then the current status of every parcel that is not delivered yet
  const parcels = await fetchParcels(ship);
  const open = parcels.filter((p) => !["delivered", "cancelled"].includes(bucketOf(p.code))).map((p) => p.cn);
  const tr = await trackAll(open, !!refresh, deadline);
  if (tr.failed) warnings.push(`${tr.failed} TCS status lookup(s) failed, those parcels show as "In process". Press Refresh TCS status to retry.`);

  // 3. Parcels that belong to older orders: find the order so the product cost is known
  const { unmatched } = matchParcels(orders, parcels);
  const refs = [...new Set(unmatched.map((p) => p.ref).filter(Boolean))].slice(0, 60);
  const lk = await lookupOlder(refs, deadline);
  if (lk.skipped) warnings.push(`${lk.skipped} older order(s) weren't looked up in time, so their product cost is missing.`);

  const out = buildReport({ date, ship, orders, excluded, parcels, track: tr.map, older: lk.map, ads, warnings });
  out.cache = { reused: tr.hits, fetched: tr.fetched };
  return out;
}
