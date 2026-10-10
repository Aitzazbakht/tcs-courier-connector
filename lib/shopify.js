// Shopify Admin GraphQL client using the client credentials grant (Dev Dashboard app installed on own store).
import { current, withStore } from "./store.js";

const API_VERSION = "2026-07";
const SHOP = () => current().domain;
const tokens = new Map(); // per store domain

async function token() {
  const st = current();
  if (st.key === "house" && process.env.SHOPIFY_ACCESS_TOKEN) return process.env.SHOPIFY_ACCESS_TOKEN; // optional static token
  const tok = tokens.get(st.domain) || { t: null, exp: 0 };
  if (tok.t && Date.now() < tok.exp - 60_000) return tok.t;
  const suffix = st.key === "house" ? "" : "_" + st.key.toUpperCase();
  const client_id = process.env["SHOPIFY_CLIENT_ID" + suffix] || process.env.SHOPIFY_CLIENT_ID;
  const client_secret = process.env["SHOPIFY_CLIENT_SECRET" + suffix] || process.env.SHOPIFY_CLIENT_SECRET;
  if (!client_id || !client_secret) throw new Error("Missing SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET environment variables.");
  const r = await fetch(`https://${SHOP()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id, client_secret }),
  });
  const text = await r.text();
  let d; try { d = JSON.parse(text); } catch { d = { raw: text.slice(0, 300) }; }
  if (!r.ok || !d.access_token) throw new Error(`Shopify token error (${st.label}) HTTP ${r.status}: ${JSON.stringify(d).slice(0, 300)}`);
  tokens.set(st.domain, { t: d.access_token, exp: Date.now() + (d.expires_in || 86399) * 1000 });
  return d.access_token;
}

export async function gql(query, variables = {}) {
  const t = await token();
  const r = await fetch(`https://${SHOP()}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": t },
    body: JSON.stringify({ query, variables }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.errors) throw new Error(`Shopify API error HTTP ${r.status}: ${JSON.stringify(d.errors || d).slice(0, 400)}`);
  return d.data;
}

const ORDER_FIELDS = `id name createdAt tags note phone email displayFinancialStatus displayFulfillmentStatus cancelledAt paymentGatewayNames
  totalPriceSet { shopMoney { amount } } totalOutstandingSet { shopMoney { amount } }
  shippingAddress { name firstName lastName address1 address2 city phone }
  lineItems(first: 20) { nodes { title quantity variantTitle } }`;

export async function listOrders(search, max = 250) {
  const out = [];
  let after = null;
  while (out.length < max) {
    const d = await gql(
      `query Orders($q: String!, $after: String) { orders(first: 100, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor } nodes { ${ORDER_FIELDS} } } }`,
      { q: search, after }
    );
    out.push(...d.orders.nodes);
    if (!d.orders.pageInfo.hasNextPage) break;
    after = d.orders.pageInfo.endCursor;
  }
  return out.slice(0, max);
}

export async function getOrder(id) {
  const d = await gql(`query Order($id: ID!) { order(id: $id) { ${ORDER_FIELDS} fulfillmentOrders(first: 10) { nodes { id status } } } }`, { id });
  return d.order;
}

export async function addTags(id, tags) {
  const d = await gql(`mutation Tag($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`, { id, tags });
  const e = d.tagsAdd.userErrors; if (e?.length) throw new Error("Tagging failed: " + JSON.stringify(e));
}

export async function removeTags(id, tags) {
  await gql(`mutation Untag($id: ID!, $tags: [String!]!) { tagsRemove(id: $id, tags: $tags) { userErrors { field message } } }`, { id, tags });
}

export async function fulfillWithTracking(order, cn, notifyCustomer = true) {
  const open = (order.fulfillmentOrders?.nodes || []).filter((f) => ["OPEN", "IN_PROGRESS", "SCHEDULED"].includes(f.status));
  if (!open.length) return { skipped: "no open fulfillment orders" };
  const d = await gql(
    `mutation Fulfill($f: FulfillmentInput!) { fulfillmentCreate(fulfillment: $f) { fulfillment { id status } userErrors { field message } } }`,
    {
      f: {
        lineItemsByFulfillmentOrder: open.map((f) => ({ fulfillmentOrderId: f.id })),
        notifyCustomer,
        trackingInfo: { company: "TCS", number: String(cn), url: `https://www.tcsexpress.com/track/${cn}` },
      },
    }
  );
  const e = d.fulfillmentCreate.userErrors; if (e?.length) throw new Error("Fulfillment failed: " + JSON.stringify(e));
  return d.fulfillmentCreate.fulfillment;
}

export async function markPaid(id) {
  const d = await gql(
    `mutation Paid($input: OrderMarkAsPaidInput!) { orderMarkAsPaid(input: $input) { order { id displayFinancialStatus } userErrors { field message } } }`,
    { input: { id } }
  );
  const e = d.orderMarkAsPaid.userErrors; if (e?.length) throw new Error("Mark as paid failed: " + JSON.stringify(e));
  return d.orderMarkAsPaid.order.displayFinancialStatus;
}

// ---- settings stored as shop metafields (no database needed) ----
export async function getSetting(key) {
  return withStore("house", () => getSettingHere(key));
}
async function getSettingHere(key) {
  const d = await gql(`query S($k: String!) { shop { id metafield(namespace: "tcs_sync", key: $k) { value } } }`, { k: key });
  return { shopId: d.shop.id, value: d.shop.metafield?.value ?? null };
}

export async function setSetting(key, value, type = "single_line_text_field") {
  return withStore("house", () => setSettingHere(key, value, type));
}
async function setSettingHere(key, value, type) {
  const { shopId } = await getSettingHere(key);
  const d = await gql(`mutation Mf($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }`, {
    m: [{ ownerId: shopId, namespace: "tcs_sync", key, type, value: String(value) }],
  });
  const e = d.metafieldsSet.userErrors; if (e?.length) throw new Error("Saving setting failed: " + JSON.stringify(e));
}

export async function ensureWebhook(uri) {
  const d = await gql(`query Hooks { webhookSubscriptions(first: 50) { nodes { id topic uri } } }`);
  const existing = d.webhookSubscriptions.nodes.find((w) => w.topic === "ORDERS_CREATE" && w.uri === uri);
  if (existing) return { already: true, id: existing.id };
  const c = await gql(
    `mutation Hook($uri: String!) { webhookSubscriptionCreate(topic: ORDERS_CREATE, webhookSubscription: { uri: $uri, format: JSON }) { webhookSubscription { id } userErrors { field message } } }`,
    { uri }
  );
  const e = c.webhookSubscriptionCreate.userErrors; if (e?.length) throw new Error("Webhook setup failed: " + JSON.stringify(e));
  return { created: true, id: c.webhookSubscriptionCreate.webhookSubscription.id };
}
