// Abandoned carts: checkouts where the customer left a name and a phone number or email but never finished the order.
// "Mark done" is remembered in a shop metafield (no database), like the other app settings.
import * as shop from "./shopify.js";
import { perStore, normalizePhone } from "./sync.js";
import { pkWindow } from "./daily.js";
import { tagId } from "./store.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KEY = "abandoned_handled";
const MAX_HANDLED = 3000;

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
  const handled = await handledSet();
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
      url: c.abandonedCheckoutUrl || "", handled: handled.has(id),
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
