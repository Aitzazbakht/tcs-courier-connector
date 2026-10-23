// Reorder offers for past customers: one unique, single-use 10% code per customer, sent on WhatsApp with the
// ch_reorder_offer template. Who got a code is remembered in a shop metafield (phone -> [code, sent time]).
import * as shop from "./shopify.js";
import { stores, withStore } from "./store.js";
import { normalizePhone, perStore } from "./sync.js";
import { sendTemplate } from "./notify.js";
import { pkWindow } from "./daily.js";

const KEY = "mk_offered";
const TEXT_TEMPLATE = "ch_reorder_offer";
const IMAGE_TEMPLATE = "ch_reorder_offer_img";
// Header picture for the image template (uploaded in Shopify admin > Content > Files). Override with REORDER_IMAGE_URL.
const IMAGE_URL = () => process.env.REORDER_IMAGE_URL || "https://cdn.shopify.com/s/files/1/0807/3848/4508/files/image888.png?v=1792761279";
const MAX_ENTRIES = 20000;

async function loadMap() {
  try { return JSON.parse((await shop.getSetting(KEY)).value || "{}"); } catch { return {}; }
}
const pkDay = (iso) => new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(0, 10);

export async function offerState() {
  const map = await loadMap();
  const today = pkDay(new Date().toISOString());
  const todayCount = Object.values(map).filter((v) => pkDay(v[1]) === today).length;
  return { sent: map, total: Object.keys(map).length, today: todayCount };
}

const domains = new Map();
async function storefront(key) {
  if (domains.has(key)) return domains.get(key);
  const d = await withStore(key, () => shop.gql(`{ shop { primaryDomain { url } } }`));
  const url = String(d.shop.primaryDomain.url).replace(/\/$/, "");
  domains.set(key, url);
  return url;
}

async function makeCode(key, days) {
  const code = "THANKS10-" + Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const now = Date.now();
  const d = await withStore(key, () => shop.gql(
    `mutation D($d: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } } }`,
    { d: {
      title: "Reorder 10% " + code, code, startsAt: new Date(now - 60000).toISOString(), endsAt: new Date(now + days * 86400000).toISOString(),
      customerSelection: { all: true }, customerGets: { value: { percentage: 0.1 }, items: { all: true } },
      appliesOncePerCustomer: true, usageLimit: 1, combinesWith: { productDiscounts: false, orderDiscounts: false, shippingDiscounts: true },
    } }));
  const e = d.discountCodeBasicCreate.userErrors;
  if (e?.length) throw new Error("Couldn't create the code: " + e.map((x) => x.message).join("; "));
  return { code, endsAt: new Date(now + days * 86400000) };
}

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "there";
const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Asia/Karachi" });

// items: [{ phone, name, store }]. Sends at most the room left under today's cap.
export async function sendBatch(items, { days = 14, cap = 1500, testTo = "", image = true, group = "" } = {}) {
  group = String(group || "").trim().slice(0, 40);
  days = Math.max(1, Math.min(60, Number(days) || 14));
  const map = await loadMap();
  const today = pkDay(new Date().toISOString());
  let room = Math.max(0, Number(cap) - Object.values(map).filter((v) => pkDay(v[1]) === today).length);
  if (Object.keys(map).length > MAX_ENTRIES) throw new Error("The sent-offers list is full.");
  const todo = [], results = [];
  for (const it of items.slice(0, 40)) {
    const ph = normalizePhone(it.phone);
    if (testTo) { todo.push({ ...it, ph: normalizePhone(testTo) }); continue; }
    if (!ph) { results.push({ phone: it.phone, skipped: "no valid mobile number" }); continue; }
    if (map[ph]) { results.push({ phone: ph, skipped: "already sent an offer" }); continue; }
    if (room <= 0) { results.push({ phone: ph, skipped: "daily limit reached" }); continue; }
    room--; todo.push({ ...it, ph });
  }
  if (testTo && !todo[0]?.ph) throw new Error("That is not a valid Pakistani mobile number.");
  const sentNow = {};
  const queue = testTo ? todo.slice(0, 1) : todo;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const it = queue.shift();
      try {
        const key = stores().some((s) => s.key === it.store) ? it.store : "house";
        const { code, endsAt } = await makeCode(key, days);
        const link = (await storefront(key)) + "/discount/" + code + "?redirect=%2F";
        const header = image ? [{ type: "header", parameters: [{ type: "image", image: { link: IMAGE_URL() } }] }] : [];
        await sendTemplate("92" + it.ph.slice(1), image ? IMAGE_TEMPLATE : TEXT_TEMPLATE, [firstName(it.name), code, link, fmt(endsAt)], header);
        results.push({ phone: it.ph, ok: true, code, link });
        if (!testTo) sentNow[it.ph] = [code, new Date().toISOString(), group];
      } catch (e) { results.push({ phone: it.ph, error: e.message }); }
    }
  }));
  if (Object.keys(sentNow).length) {
    const fresh = await loadMap(); // merge with anything saved meanwhile
    await shop.setSetting(KEY, JSON.stringify({ ...fresh, ...sentNow }), "json");
  }
  return { results, sent: Object.keys(sentNow).length };
}

// How many of the codes were used on an order.
export async function offerResults() {
  const map = await loadMap();
  const byCode = new Map(Object.entries(map).map(([ph, v]) => [v[0], ph]));
  const sentCount = byCode.size;
  if (!sentCount) return { sent: 0, used: 0, revenue: 0, discount: 0, orders: [], groups: [] };
  const LEGACY = "First 100 (3+ orders)"; // offers sent before groups were named
  const groupOf = (code) => { const ph = byCode.get(code); return (map[ph] && map[ph][2]) || LEGACY; };
  const groups = new Map();
  for (const v of Object.values(map)) { const g = v[2] || LEGACY; (groups.get(g) || groups.set(g, { name: g, sent: 0, used: 0, revenue: 0, discount: 0 }).get(g)).sent++; }
  const since = Object.values(map).reduce((m, v) => (v[1] < m ? v[1] : m), "9999");
  const found = [];
  const { errors } = await perStore(async (st) => {
    let after = null, n = 0;
    while (n < 4000) {
      const d = await shop.gql(
        `query R($q: String!, $after: String) { orders(first: 250, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor } nodes { name createdAt cancelledAt discountCodes totalPriceSet { shopMoney { amount } } totalDiscountsSet { shopMoney { amount } } shippingAddress { name } } } }`,
        { q: `created_at:>='${since}'`, after });
      for (const o of d.orders.nodes) {
        n++;
        const code = (o.discountCodes || []).find((c) => byCode.has(c));
        if (code && !o.cancelledAt) found.push({ group: groupOf(code), store: st.label, name: o.name, customer: o.shippingAddress?.name || "", at: o.createdAt, amount: Math.round(Number(o.totalPriceSet?.shopMoney?.amount || 0)), discount: Math.round(Number(o.totalDiscountsSet?.shopMoney?.amount || 0)) });
      }
      if (!d.orders.pageInfo.hasNextPage) break;
      after = d.orders.pageInfo.endCursor;
    }
    return [];
  });
  for (const f of found) { const g = groups.get(f.group); if (g) { g.used++; g.revenue += f.amount; g.discount += f.discount; } }
  found.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { groups: [...groups.values()].map((g) => ({ ...g, rate: +((100 * g.used) / g.sent).toFixed(1) })), sent: sentCount, used: found.length, revenue: found.reduce((s, o) => s + o.amount, 0), discount: found.reduce((s, o) => s + o.discount, 0), orders: found, warnings: errors.map((e) => `${e.store}: ${e.error}`) };
}
