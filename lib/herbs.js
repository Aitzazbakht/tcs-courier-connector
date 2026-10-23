// Read-only feed of Chitral Herbs orders for one Pakistan day, straight from the Herbs Shopify store.
// It replaces the Windsor.ai "shopify" connector for the daily sales report: no sync lag, and no Windsor slot used.
import * as shop from "./shopify.js";
import { withStore } from "./store.js";
import { pkWindow } from "./daily.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const amt = (m) => Math.round(Number(m?.shopMoney?.amount) || 0);

const QUERY = `query H($q: String!, $after: String) { orders(first: 50, after: $after, query: $q, sortKey: CREATED_AT) {
  pageInfo { hasNextPage endCursor }
  nodes { name createdAt cancelledAt test sourceName tags paymentGatewayNames displayFinancialStatus note
    totalPriceSet { shopMoney { amount } } subtotalPriceSet { shopMoney { amount } }
    totalShippingPriceSet { shopMoney { amount } } totalDiscountsSet { shopMoney { amount } }
    lineItems(first: 30) { nodes { title variantTitle quantity originalUnitPriceSet { shopMoney { amount } } } } } } }`;

// created_at in Pakistan time, e.g. 2026-10-21T23:58:00+05:00
const pkTime = (iso) => new Date(Date.parse(iso) + 5 * 3600e3).toISOString().replace(/\.\d+Z$/, "+05:00");

export function shapeOrder(o) {
  const gw = (o.paymentGatewayNames || []).join(", ");
  return {
    order_name: o.name,
    created_at: pkTime(o.createdAt),
    cancelled: !!o.cancelledAt,
    test: !!o.test,
    payment: /cash on delivery|cod/i.test(gw) ? "COD" : "Prepaid",
    financial_status: o.displayFinancialStatus || "",
    source_name: o.sourceName || "",
    total: amt(o.totalPriceSet), subtotal: amt(o.subtotalPriceSet), shipping: amt(o.totalShippingPriceSet), discounts: amt(o.totalDiscountsSet),
    tags: o.tags || [],
    items: (o.lineItems?.nodes || []).map((l) => ({ title: l.title, variant: l.variantTitle && l.variantTitle !== "Default Title" ? l.variantTitle : "", quantity: Number(l.quantity) || 0, price: amt(l.originalUnitPriceSet) })),
  };
}

export async function herbsOrders(date, fetcher = (q, v) => shop.gql(q, v)) {
  if (!ISO.test(date || "")) throw new Error("date must be YYYY-MM-DD");
  const win = pkWindow(date);
  const nodes = await withStore("herbs", async () => {
    const out = [];
    let after = null;
    for (let i = 0; i < 40; i++) {
      const d = await fetcher(QUERY, { q: `created_at:>='${win.start}' AND created_at:<'${win.end}'`, after });
      out.push(...d.orders.nodes);
      if (!d.orders.pageInfo.hasNextPage) break;
      after = d.orders.pageInfo.endCursor;
    }
    return out;
  });
  const orders = nodes.map(shapeOrder).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const live = orders.filter((o) => !o.cancelled && !o.test);
  return {
    store: "Chitral Herbs", date, window: { start: win.start, end: win.end, note: "Pakistan day, UTC window" },
    pulled_at: new Date(Date.now() + 5 * 3600e3).toISOString().replace(/\.\d+Z$/, "+05:00"),
    latest_order_at: orders.length ? orders[orders.length - 1].created_at : null,
    counts: { all: orders.length, live: live.length, cancelled: orders.filter((o) => o.cancelled).length, test: orders.filter((o) => o.test).length },
    live_total: live.reduce((s, o) => s + o.total, 0), live_subtotal: live.reduce((s, o) => s + o.subtotal, 0),
    orders,
  };
}
