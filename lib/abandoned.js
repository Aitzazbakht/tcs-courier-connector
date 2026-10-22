// Abandoned carts: checkouts where the customer left a name and a phone number or email but never finished the order.
// "Mark done" is remembered in a shop metafield (no database), like the other app settings.
import * as shop from "./shopify.js";
import { perStore, normalizePhone } from "./sync.js";
import { pkWindow } from "./daily.js";
import { tagId, splitId, withStore } from "./store.js";
import { sendTemplate, waNumber } from "./notify.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KEY = "abandoned_handled";
const MAX_HANDLED = 3000;
const OFFER_KEY = "abandoned_offered";
const TEMPLATE = "ch_cart_recovery";

async function offeredMap() {
  try { return JSON.parse((await shop.getSetting(OFFER_KEY)).value || "{}"); } catch { return {}; }
}

async function handledSet() {
  try { return new Set(JSON.parse((await shop.getSetting(KEY)).value || "[]")); } catch { return new Set(); }
}

export async function listAbandoned(from, to) {
  const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  to = ISO.test(to || "") ? to : today;
  from = ISO.test(from || "") ? from : new Date(Date.parse(to) - 6 * 86400000).toISOString().slice(0, 10);
  if (to < from) throw new Error("The end date is before the start date.");
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 90) throw new Error("Pick a range of 90 days or less.");
  const win = { start: pkWindow(from).start, end: pkWindow(to).end };
  const [handled, offered] = await Promise.all([handledSet(), offeredMap()]);
  const { rows, errors } = await perStore(async () => {
    const out = []; let after = null;
    while (out.length < 1000) {
      const run = (withCustomer) => shop.gql(
        `query A($q: String!, $after: String) { abandonedCheckouts(first: 100, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor }
          nodes { id createdAt completedAt abandonedCheckoutUrl totalPriceSet { shopMoney { amount } }
            ${withCustomer ? "customer { firstName lastName email phone }" : ""}
            shippingAddress { name phone city } billingAddress { name phone city }
            lineItems(first: 5) { nodes { title quantity } } } } }`,
        { q: `created_at:>='${win.start}' AND created_at:<'${win.end}'`, after });
      // Names and emails live on the customer record, which needs the read_customers scope. Without it, fall back to
      // the name and phone typed into the checkout address.
      let d;
      try { d = await run(true); } catch (e) { if (!/read_customers|ACCESS_DENIED/i.test(e.message)) throw e; d = await run(false); }
      out.push(...d.abandonedCheckouts.nodes);
      if (!d.abandonedCheckouts.pageInfo.hasNextPage) break;
      after = d.abandonedCheckouts.pageInfo.endCursor;
    }
    return out;
  });
  const list = [];
  for (const c of rows) {
    if (c.completedAt) continue;
    const name = [c.customer?.firstName, c.customer?.lastName].filter(Boolean).join(" ").trim() || c.shippingAddress?.name || c.billingAddress?.name || "";
    const phone = c.shippingAddress?.phone || c.billingAddress?.phone || c.customer?.phone || "";
    const email = c.customer?.email || "";
    if (!name.trim() || !(phone.trim() || email.trim())) continue; // nothing to contact them with
    const id = tagId(c.store, c.id);
    list.push({
      id, store: c.store, storeLabel: c.storeLabel, createdAt: c.createdAt, name: name.trim(), phone: phone.trim(), email,
      wa: normalizePhone(phone), city: c.shippingAddress?.city || c.billingAddress?.city || "",
      amount: Math.round(Number(c.totalPriceSet?.shopMoney?.amount || 0)),
      items: (c.lineItems?.nodes || []).map((l) => `${l.quantity} x ${l.title}`).join(", "),
      url: c.abandonedCheckoutUrl || "", handled: handled.has(id), offered: offered[id]?.at || "",
    });
  }
  list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { from, to, rows: list, warnings: errors.map((e) => `${e.store}: ${e.error}`) };
}

export async function markAbandonedHandled(id) {
  const set = await handledSet();
  set.add(String(id));
  await shop.setSetting(KEY, JSON.stringify([...set].slice(-MAX_HANDLED)), "json");
  return { ok: true };
}

// ---------- 10% offer on WhatsApp ----------
const CHECKOUT = (withCustomer) => `query C($id: ID!) { node(id: $id) { ... on AbandonedCheckout { id completedAt abandonedCheckoutUrl
  ${withCustomer ? "customer { firstName lastName phone }" : ""} shippingAddress { name phone } billingAddress { name phone } } } }`;

async function makeCode() {
  const code = "BACK10-" + Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const now = Date.now();
  const d = await shop.gql(
    `mutation D($d: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } } }`,
    { d: {
      title: "Abandoned cart 10% " + code, code, startsAt: new Date(now - 60000).toISOString(), endsAt: new Date(now + 7 * 86400000).toISOString(),
      customerSelection: { all: true }, customerGets: { value: { percentage: 0.1 }, items: { all: true } },
      appliesOncePerCustomer: true, usageLimit: 1, combinesWith: { productDiscounts: false, orderDiscounts: false, shippingDiscounts: true },
    } });
  const e = d.discountCodeBasicCreate.userErrors;
  if (e?.length) throw new Error("Couldn't create the discount code: " + e.map((x) => x.message).join("; "));
  return code;
}

// The link first applies the code, then opens the customer's own saved checkout.
export function offerLink(checkoutUrl, code) {
  const u = new URL(checkoutUrl);
  return `${u.origin}/discount/${code}?redirect=${encodeURIComponent(u.pathname + u.search)}`;
}

export async function sendOffer(id, { testTo = "" } = {}) {
  const { store, gid } = splitId(id);
  const offered = await offeredMap();
  if (!testTo && offered[id]) throw new Error("An offer was already sent for this cart.");
  return withStore(store, async () => {
    let c;
    try { c = (await shop.gql(CHECKOUT(true), { id: gid })).node; }
    catch (e) { if (!/read_customers|ACCESS_DENIED/i.test(e.message)) throw e; c = (await shop.gql(CHECKOUT(false), { id: gid })).node; }
    if (!c) throw new Error("That cart was not found.");
    if (c.completedAt) throw new Error("This customer already completed their order.");
    if (!c.abandonedCheckoutUrl) throw new Error("This cart has no checkout link.");
    const phone = c.shippingAddress?.phone || c.billingAddress?.phone || c.customer?.phone || "";
    const to = testTo ? "92" + (normalizePhone(testTo) || "").slice(1) : waNumber({ shippingAddress: { phone } });
    if (!to || to === "92") throw new Error(testTo ? "That is not a valid Pakistani mobile number." : "No valid WhatsApp number on this cart.");
    const full = c.customer?.firstName || c.shippingAddress?.name || c.billingAddress?.name || "there";
    const first = String(full).trim().split(/\s+/)[0] || "there";
    const code = await makeCode();
    const link = offerLink(c.abandonedCheckoutUrl, code);
    await sendTemplate(to, TEMPLATE, [first, link]);
    if (!testTo) {
      offered[id] = { code, at: new Date().toISOString() };
      await shop.setSetting(OFFER_KEY, JSON.stringify(offered), "json");
      await markAbandonedHandled(id); // sending the offer counts as handled
    }
    return { ok: true, code, link, to: testTo ? to : undefined, test: !!testTo };
  });
}

// ---------- how many offers worked ----------
// An offer worked when an order was placed with the one-time code we sent for that cart.
export async function offerStats(from, to) {
  const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  to = ISO.test(to || "") ? to : today;
  from = ISO.test(from || "") ? from : new Date(Date.parse(to) - 6 * 86400000).toISOString().slice(0, 10);
  const win = { start: pkWindow(from).start, end: pkWindow(to).end };
  const offered = await offeredMap();
  const sent = Object.entries(offered).filter(([, v]) => v.at >= win.start && v.at < win.end);
  const byCode = new Map(sent.map(([id, v]) => [v.code, { id, at: v.at }]));
  if (!sent.length) return { from, to, sent: 0, orders: [], recovered: 0, revenue: 0, discount: 0, rate: null };
  const since = sent.reduce((m, [, v]) => (v.at < m ? v.at : m), sent[0][1].at);
  const found = [];
  const { errors } = await perStore(async (st) => {
    let after = null, n = 0;
    while (n < 3000) {
      const d = await shop.gql(
        `query R($q: String!, $after: String) { orders(first: 250, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor } nodes { name createdAt cancelledAt discountCodes totalPriceSet { shopMoney { amount } } totalDiscountsSet { shopMoney { amount } } shippingAddress { name } } } }`,
        { q: `created_at:>='${since}'`, after });
      for (const o of d.orders.nodes) {
        n++;
        const code = (o.discountCodes || []).find((c) => byCode.has(c));
        if (code && !o.cancelledAt) found.push({ store: st.label, name: o.name, customer: o.shippingAddress?.name || "", at: o.createdAt, code, amount: Math.round(Number(o.totalPriceSet?.shopMoney?.amount || 0)), discount: Math.round(Number(o.totalDiscountsSet?.shopMoney?.amount || 0)) });
      }
      if (!d.orders.pageInfo.hasNextPage) break;
      after = d.orders.pageInfo.endCursor;
    }
    return [];
  });
  found.sort((x, y) => String(y.at).localeCompare(String(x.at)));
  const revenue = found.reduce((s, o) => s + o.amount, 0), discount = found.reduce((s, o) => s + o.discount, 0);
  return { from, to, sent: sent.length, orders: found, recovered: found.length, revenue, discount, rate: +((100 * found.length) / sent.length).toFixed(1), warnings: errors.map((e) => `${e.store}: ${e.error}`) };
}
