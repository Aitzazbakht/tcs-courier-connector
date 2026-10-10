// Shopify orders/create webhook -> book on TCS when auto mode is on.
import { shopifyHmacOk, rawBody } from "../lib/auth.js";
import * as sync from "../lib/sync.js";
import * as notify from "../lib/notify.js";
import * as shop from "../lib/shopify.js";
import { withStore, getStore, tagId, clientSecretFor } from "../lib/store.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const raw = await rawBody(req);
  const storeKeyQ = getStore(new URL(req.url, "http://x").searchParams.get("store") || "house").key;
  if (!shopifyHmacOk(raw, req.headers["x-shopify-hmac-sha256"], clientSecretFor(storeKeyQ))) return res.status(401).send("Bad signature");
  let order;
  try { order = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).end(); }
  const storeKey = getStore(new URL(req.url, "http://x").searchParams.get("store") || "house").key;
  return withStore(storeKey, () => handleOrder(res, order, storeKey));
}

async function handleOrder(res, order, storeKey) {
  try {
    const gid = order.admin_graphql_api_id || `gid://shopify/Order/${order.id}`;
    const id = tagId(storeKey, gid);
    const [auto, waOn] = await Promise.all([sync.isAutoOn(), notify.isOn()]);
    const isWhatsAppOrder = String(order.tags || "").split(/,\s*/).some((t) => /^whatsapp$/i.test(t));
    if (waOn && !isWhatsAppOrder) {
      const full = await shop.getOrder(gid);
      const c = await notify.sendConfirm(full).catch((e) => ({ error: e.message }));
      console.log("wa-confirm", order.name, JSON.stringify(c));
      if (c.sent) return res.status(200).json({ confirmation: c, booking: "waits for customer confirmation" });
    }
    if (!auto) return res.status(200).json({ skipped: "auto mode off" });
    const r = await sync.pushOrder(id);
    console.log("auto-book", order.name, JSON.stringify(r));
    return res.status(200).json(r);
  } catch (e) {
    console.error("auto-book failed", order?.name, e.message);
    return res.status(200).json({ error: e.message }); // 200 so Shopify doesn't keep retrying; order stays on the page
  }
}
