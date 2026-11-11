// Return orders: parcels TCS sent back, matched to their Shopify orders, with a short return reason, a follow-up status
// (kept as a tag on the Shopify order, so it shows in Shopify too) and a one-click "Book this order" that creates a fresh,
// WhatsApp-confirmed copy of the order in the same store and marks the old one as rebooked.
import * as tcs from "./tcs.js";
import * as shop from "./shopify.js";
import { stores, withStore, tagId, splitId } from "./store.js";
import { bulkStatuses } from "./report.js";
import { bucketOf, isoOf } from "./tools.js";
import { TAG, codOf } from "./notify.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;
const MAX_DAYS = 186; // TCS status lists are fetched in weekly windows; ~6 months keeps one request inside the 60s limit

// ---- return reasons: short codes shown in the table, with the full wording as a tooltip ----
export const REASONS = {
  RD: "Refused delivery",
  NH: "Customer not home / not available",
  NR: "No response, phone off",
  BA: "Bad or incomplete address",
  UL: "Unable to locate address",
  WN: "Wrong or missing phone number",
  CL: "Premises closed",
  SH: "Receiver shifted",
  CC: "Customer cancelled",
  DM: "Parcel damaged",
  OA: "Out of delivery area",
  HO: "On hold too long",
  OT: "Other / not stated",
};
// TCS delivery-status codes (see the delivery problems tab) mapped to the short codes above
const FROM_TCS = {
  HN: "NH", CN: "NH", MO: "NR", NM: "NR", NR: "NR", BA: "BA", BD: "BA", WA: "BA", IA: "BA", UL: "UL", NP: "SH", CS: "SH",
  RC: "CL", CA: "CL", HC: "CL", WM: "WN", WP: "WN", NT: "WN", AN: "WN", NS: "OA", OS: "OA", DM: "DM", RD: "RD", OH: "HO", TH: "HO", HP: "HO",
};
const TEXTS = [
  [/refus/i, "RD"], [/cancel/i, "CC"], [/not home|consignee not|not available|nobody|no one/i, "NH"],
  [/switched off|no response|not respond|unreachable|not answer/i, "NR"], [/unable to locate/i, "UL"],
  [/bad address|wrong address|incomplete address|address (not found|problem)/i, "BA"],
  [/wrong (phone|number|mobile)|invalid (phone|number|mobile)|no phone/i, "WN"],
  [/premises closed|address closed|shop closed|closed/i, "CL"], [/shifted|moved/i, "SH"], [/damag/i, "DM"],
  [/out of (delivery )?area|not serviceable/i, "OA"], [/on hold/i, "HO"],
];

// Reads a TCS tracking answer and returns the most likely reason the parcel came back. A refusal anywhere in the history wins.
export function reasonOfTrack(d) {
  const cands = [];
  for (const x of d?.deliveryinfo || []) cands.push({ code: String(x.code || "").toUpperCase(), text: String(x.status || "") });
  for (const c of d?.checkpoints || []) cands.push({ code: "", text: String(c.status || "") });
  const hit = (c) => FROM_TCS[c.code] || (TEXTS.find(([re]) => re.test(c.text)) || [])[1] || "";
  const rd = cands.find((c) => hit(c) === "RD");
  if (rd) return { code: "RD", label: REASONS.RD, text: rd.text };
  for (const c of cands) { const k = hit(c); if (k) return { code: k, label: REASONS[k], text: c.text }; }
  return { code: "OT", label: REASONS.OT, text: cands[0]?.text || "" };
}

// ---- follow-up status, stored as one "ret-st:<status>" tag on the Shopify order ----
export const ST_PREFIX = "ret-st:";
export const PRESET = { contacted: "contacted", reorder: "reorder confirm", dontneed: "dont need", rebooked: "rebooked" };
export function statusOfTags(tags) {
  const t = (tags || []).find((x) => String(x).toLowerCase().startsWith(ST_PREFIX));
  if (!t) return { key: "", text: "" };
  const text = t.slice(ST_PREFIX.length).trim();
  const key = Object.keys(PRESET).find((k) => PRESET[k] === text.toLowerCase());
  return key ? { key, text: PRESET[key] } : { key: "custom", text };
}
export function tagForStatus(key, text) {
  if (!key) return "";
  if (PRESET[key]) return ST_PREFIX + PRESET[key];
  if (key === "custom") {
    const t = String(text || "").replace(/[,\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!t) throw new Error("Type the status text first.");
    return ST_PREFIX + t;
  }
  throw new Error("Unknown status");
}
const rebookedAsOf = (tags) => { const t = (tags || []).find((x) => /^rebooked-as:/i.test(x)); return t ? t.slice(t.indexOf(":") + 1) : ""; };

// ---- finding the Shopify order behind each returned parcel (the app tags every booked order TCS-<cn>) ----
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k]); } }));
}
async function ordersByCn(cns, warnings, deadline) {
  const map = new Map();
  if (!cns.length) return map;
  await Promise.all(stores().map((st) => withStore(st.key, async () => {
    try {
      await pool(chunk(cns, 25), 4, async (b) => {
        if (Date.now() > deadline) return;
        const list = await shop.listOrders("(" + b.map((c) => "tag:TCS-" + c).join(" OR ") + ")", 300);
        for (const o of list) for (const t of o.tags || []) { const m = /^TCS-(\d{6,})$/i.exec(t); if (m && !map.has(m[1])) map.set(m[1], { o, st }); }
      });
    } catch (e) { warnings.push(st.label + ": couldn't read orders (" + e.message + ")"); }
  })));
  return map;
}

// ---- reasons come from TCS tracking, once per parcel (returns never change, so keep them for hours) ----
const reasonCache = new Map();
const REASON_TTL = 6 * 3600e3;
async function reasonsFor(cns, refresh, deadline) {
  const out = new Map(), todo = [];
  for (const cn of cns) { const c = reasonCache.get(cn); if (c && !refresh && Date.now() - c.at < REASON_TTL) out.set(cn, c.r); else todo.push(cn); }
  await pool(todo, 12, async (cn) => {
    if (Date.now() > deadline) return;
    try {
      const d = await tcs.track([cn]);
      const sh = d?.shipmentinfo?.[0] || {};
      const r = { ...reasonOfTrack(d), consignee: sh.consignee || "", dest: sh.destination || "" };
      reasonCache.set(cn, { at: Date.now(), r }); out.set(cn, r);
    } catch { /* shown as "checking" and retried next time */ }
  });
  return out;
}

const bookedIso = (v) => (ISO.test(String(v || "").slice(0, 10)) ? String(v).slice(0, 10) : isoOf(v) || "");

export async function listReturns({ from, to, refresh = false } = {}) {
  if (!ISO.test(from) || !ISO.test(to) || to < from) throw new Error("Pick a valid date range.");
  if ((Date.parse(to) - Date.parse(from)) / DAY + 1 > MAX_DAYS) throw new Error("Pick a range of 6 months or less.");
  const deadline = Date.now() + 48000, warnings = [];
  const bs = await bulkStatuses(from, to);
  warnings.push(...bs.errors.map((e) => "TCS status list: " + e));
  const rets = bs.rows.filter((r) => bucketOf(r.status_code) === "returned");
  const cns = rets.map((r) => String(r.cn));
  const [byCn, why] = await Promise.all([ordersByCn(cns, warnings, deadline), reasonsFor(cns, refresh, deadline)]);
  const rows = rets.map((r) => {
    const cn = String(r.cn), hit = byCn.get(cn), o = hit?.o, rz = why.get(cn);
    const st = o ? statusOfTags(o.tags) : { key: "", text: "" }, as = o ? rebookedAsOf(o.tags) : "";
    const items = (o?.lineItems?.nodes || []).map((i) => ({ title: i.title + (i.variantTitle ? " (" + i.variantTitle + ")" : ""), qty: i.quantity }));
    const a = o?.shippingAddress;
    const done = st.key === "rebooked" || !!as;
    return {
      id: o ? tagId(hit.st.key, o.id) : "", store: hit?.st.key || "", storeLabel: hit?.st.label || "", cn, order: o?.name || "", createdAt: o?.createdAt || "",
      booked: bookedIso(r.booked), customer: a?.name || rz?.consignee || "", phone: a?.phone || o?.phone || "",
      address: [a?.address1, a?.address2].filter(Boolean).join(", "), city: a?.city || r.city || rz?.dest || "",
      items, products: items.map((i) => i.title + " x" + i.qty).join(", "),
      amount: r.amount > 0 ? r.amount : o ? codOf(o) : 0,
      tcsState: r.status_code === "RT" ? "Return in transit" : "Returned",
      reason: rz ? { code: rz.code, label: rz.label, text: rz.text } : null,
      status: done ? { key: "rebooked", text: "rebooked" } : st, rebookedAs: as,
      canBook: !!o && !done && items.length > 0,
    };
  }).sort((x, y) => String(y.booked).localeCompare(String(x.booked)) || String(y.order).localeCompare(String(x.order)));
  const waiting = rows.filter((r) => !r.reason).length;
  if (waiting) warnings.push(waiting + " return reason(s) are still loading from TCS. Press Refresh to load the rest.");
  const noOrder = rows.filter((r) => !r.id).length;
  if (noOrder) warnings.push(noOrder + " returned parcel(s) have no matching Shopify order (booked outside the app), so they can't be rebooked here.");
  return { rows, warnings, from, to, reasons: REASONS };
}

// ---- setting the follow-up status ----
export async function setReturnStatus(id, key, text) {
  const { store, gid } = splitId(id);
  const tag = tagForStatus(key, text);
  return withStore(store, async () => {
    const o = await shop.getOrder(gid);
    if (!o) throw new Error("Order not found");
    const old = (o.tags || []).filter((t) => String(t).toLowerCase().startsWith(ST_PREFIX));
    if (old.length) await shop.removeTags(gid, old);
    if (tag) await shop.addTags(gid, [tag]);
    return { ok: true, status: statusOfTags(tag ? [tag] : []) };
  });
}

// ---- Book this order: a new, confirmed copy of the returned order ----
const ORDER_Q = `query R($id: ID!) { order(id: $id) { id name tags phone email note currencyCode cancelledAt customer { id }
  shippingAddress { firstName lastName address1 address2 city province zip countryCodeV2 phone company }
  shippingLines(first: 5) { nodes { title discountedPriceSet { shopMoney { amount } } } }
  lineItems(first: 50) { nodes { title quantity sku requiresShipping variant { id } discountedUnitPriceSet { shopMoney { amount } } } } } }`;
const MUT = `mutation Create($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
  orderCreate(order: $order, options: $options) {
    order { id name totalPriceSet { shopMoney { amount } } }
    userErrors { field message code }
  }
}`;
const money = (n, cur) => ({ shopMoney: { amount: Number(n || 0).toFixed(2), currencyCode: cur || "PKR" } });
const numId = (gid) => String(gid).split("/").pop();

// Pure: the order we ask Shopify to create. Same items, same prices (discounts already applied), same address, cash on delivery,
// already confirmed on WhatsApp (so the confirmation message is not sent again) and tagged as a rebooking.
export function buildRebookInput(o) {
  const cur = o.currencyCode || "PKR", a = o.shippingAddress || {};
  const lineItems = (o.lineItems?.nodes || []).map((n) => {
    const price = money(n.discountedUnitPriceSet?.shopMoney?.amount, cur);
    return n.variant?.id ? { variantId: n.variant.id, quantity: n.quantity, priceSet: price }
      : { title: n.title, quantity: n.quantity, priceSet: price, requiresShipping: n.requiresShipping !== false, taxable: false, ...(n.sku ? { sku: n.sku } : {}) };
  });
  const input = {
    currency: cur,
    phone: o.phone || a.phone || undefined,
    tags: [TAG.CONFIRMED, "rebooked", "rebook-of:" + o.name],
    note: "Rebooked from " + o.name + " (returned by TCS)",
    sourceIdentifier: "rebook-" + numId(o.id),
    lineItems,
    financialStatus: "PENDING",
    shippingAddress: { firstName: a.firstName || "", lastName: a.lastName || ".", address1: a.address1 || "", ...(a.address2 ? { address2: a.address2 } : {}), city: a.city || "", ...(a.province ? { province: a.province } : {}), ...(a.zip ? { zip: a.zip } : {}), countryCode: a.countryCodeV2 || "PK", ...(a.phone || o.phone ? { phone: a.phone || o.phone } : {}), ...(a.company ? { company: a.company } : {}) },
  };
  const ship = (o.shippingLines?.nodes || []).filter((s) => Number(s.discountedPriceSet?.shopMoney?.amount) > 0);
  if (ship.length) input.shippingLines = ship.map((s) => ({ title: s.title || "Delivery", priceSet: money(s.discountedPriceSet.shopMoney.amount, cur) }));
  if (o.customer?.id) input.customer = { toAssociate: { id: o.customer.id } };
  return input;
}

export async function rebookReturn(id) {
  const { store, gid } = splitId(id);
  return withStore(store, async () => {
    const d = await shop.gql(ORDER_Q, { id: gid });
    const o = d.order;
    if (!o) throw new Error("Order not found in Shopify.");
    const already = rebookedAsOf(o.tags);
    if (already) throw new Error("Already rebooked as " + already + ".");
    if (!(o.lineItems?.nodes || []).length) throw new Error("This order has no items to copy.");
    const r = (await shop.gql(MUT, { order: buildRebookInput(o), options: { inventoryBehaviour: "DECREMENT_IGNORING_POLICY", sendReceipt: false, sendFulfillmentReceipt: false } })).orderCreate;
    if (r.userErrors?.length || !r.order) throw new Error((r.userErrors || []).map((e) => e.message).join("; ") || "Shopify did not create the order.");
    let warning = "";
    try {
      const old = (o.tags || []).filter((t) => String(t).toLowerCase().startsWith(ST_PREFIX));
      if (old.length) await shop.removeTags(gid, old);
      await shop.addTags(gid, [ST_PREFIX + "rebooked", "rebooked-as:" + r.order.name]);
    } catch (e) { warning = "The new order was created, but the old order could not be marked: " + e.message; }
    return { ok: true, order: r.order.name, id: tagId(store, r.order.id), total: r.order.totalPriceSet.shopMoney.amount, status: { key: "rebooked", text: "rebooked" }, rebookedAs: r.order.name, warning };
  });
}
