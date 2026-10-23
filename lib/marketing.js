// Marketing Workflow: every order from both stores, exported with Shopify's bulk operation (no rate limits, runs on
// Shopify's side), then streamed to the browser as compact lines. The browser keeps the data and does the sorting.
import * as shop from "./shopify.js";
import { stores, withStore } from "./store.js";
import { normalizePhone, shortTitle } from "./sync.js";

const DAYS = 60; // only the last two months (older orders need the read_all_orders scope)
const queryFor = () => `{ orders(query: "created_at:>=${new Date(Date.now() - DAYS * 86400e3).toISOString().slice(0, 10)}") { edges { node { id name createdAt cancelledAt tags phone displayFinancialStatus
  totalPriceSet { shopMoney { amount } } shippingAddress { name phone city } billingAddress { phone }
  lineItems { edges { node { title variantTitle quantity } } } } } } }`;

const OP = `id status errorCode createdAt completedAt objectCount url partialDataUrl`;

export async function startExport() {
  const out = [];
  for (const st of stores()) {
    try {
      const d = await withStore(st.key, () => shop.gql(
        `mutation B($q: String!) { bulkOperationRunQuery(query: $q) { bulkOperation { id status } userErrors { field message code } } }`, { q: queryFor() }));
      const r = d.bulkOperationRunQuery;
      if (r.userErrors?.length) {
        // an export that is already running is fine: follow it
        const cur = await withStore(st.key, () => shop.gql(`{ currentBulkOperation(type: QUERY) { ${OP} } }`));
        if (cur.currentBulkOperation && ["CREATED", "RUNNING"].includes(cur.currentBulkOperation.status)) { out.push({ key: st.key, label: st.label, id: cur.currentBulkOperation.id, status: cur.currentBulkOperation.status }); continue; }
        throw new Error(r.userErrors.map((e) => e.message).join("; "));
      }
      out.push({ key: st.key, label: st.label, id: r.bulkOperation.id, status: r.bulkOperation.status });
    } catch (e) { out.push({ key: st.key, label: st.label, error: e.message }); }
  }
  return { stores: out };
}

export async function exportStatus() {
  const out = [];
  for (const st of stores()) {
    try {
      const d = await withStore(st.key, () => shop.gql(`{ currentBulkOperation(type: QUERY) { ${OP} } }`));
      const o = d.currentBulkOperation;
      out.push({ key: st.key, label: st.label, id: o?.id || null, status: o?.status || "NONE", count: Number(o?.objectCount || 0), error: o?.errorCode || null });
    } catch (e) { out.push({ key: st.key, label: st.label, error: e.message }); }
  }
  return { stores: out };
}

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

// Streams one store's finished export to `res` as newline-separated JSON, one compact order per line.
export async function streamStore(key, res) {
  const st = stores().find((s) => s.key === key);
  if (!st) throw new Error("Unknown store.");
  const d = await withStore(st.key, () => shop.gql(`{ currentBulkOperation(type: QUERY) { ${OP} } }`));
  const op = d.currentBulkOperation;
  if (!op || op.status !== "COMPLETED") throw new Error("The export is not finished yet.");
  if (!op.url) { res.setHeader("Content-Type", "application/x-ndjson"); res.statusCode = 200; return res.end(); } // no orders
  const r = await fetch(op.url);
  if (!r.ok) throw new Error("Couldn't download the export (HTTP " + r.status + ").");
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-store");

  const orders = new Map();
  const dec = new TextDecoder();
  let buf = "";
  const take = (line) => {
    if (!line) return;
    let o; try { o = JSON.parse(line); } catch { return; }
    if (o.__parentId) {
      const p = orders.get(o.__parentId); if (!p || !(o.quantity > 0)) return;
      p.items.push(`${shortTitle(o.title)}${o.variantTitle ? " " + o.variantTitle : ""}${o.quantity > 1 ? "*" + o.quantity : ""}`);
      return;
    }
    if (!o.name) return;
    const tags = (o.tags || []).map((t) => String(t).toLowerCase());
    const raw = o.shippingAddress?.phone || o.phone || o.billingAddress?.phone || "";
    const phone = normalizePhone(raw) || String(raw).replace(/\D/g, "");
    orders.set(o.id, {
      s: st.key, n: o.name, d: o.createdAt, c: clean(o.shippingAddress?.name), p: phone, y: clean(o.shippingAddress?.city),
      a: Math.round(Number(o.totalPriceSet?.shopMoney?.amount || 0)), items: [],
      x: o.cancelledAt || tags.includes("fake-order") || /refunded|voided/i.test(o.displayFinancialStatus || "") ? 1 : 0,
    });
  };
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) { take(buf.slice(0, i)); buf = buf.slice(i + 1); }
  }
  take(buf);
  let batch = [];
  for (const o of orders.values()) {
    const { items, ...rest } = o;
    batch.push(JSON.stringify({ ...rest, i: items.join(" + ").slice(0, 160) }));
    if (batch.length >= 1500) { res.write(batch.join("\n") + "\n"); batch = []; }
  }
  if (batch.length) res.write(batch.join("\n") + "\n");
  res.end();
}
