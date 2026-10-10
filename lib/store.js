// Multi-store support: which Shopify store the current work is for.
import { AsyncLocalStorage } from "node:async_hooks";

const clean = (d) => String(d || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

export function stores() {
  const list = [
    { key: "house", label: "Chitral House", domain: clean(process.env.SHOPIFY_SHOP || "6d8810-2.myshopify.com") },
  ];
  const herbs = clean(process.env.SHOPIFY_SHOP_HERBS || "31285b-4.myshopify.com");
  if (herbs) list.push({ key: "herbs", label: "Chitral Herbs", domain: herbs });
  return list;
}

export const getStore = (key) => stores().find((s) => s.key === key) || stores()[0];

const als = new AsyncLocalStorage();
export const current = () => als.getStore() || stores()[0];
export const withStore = (key, fn) => als.run(getStore(key), fn);

// Order ids shown on the page carry their store: "herbs~gid://shopify/Order/123"
export const tagId = (storeKey, gid) => (storeKey === "house" ? gid : `${storeKey}~${gid}`);
export function splitId(id) {
  const s = String(id);
  const i = s.indexOf("~");
  return i > 0 ? { store: s.slice(0, i), gid: s.slice(i + 1) } : { store: "house", gid: s };
}

// Each store has its own Shopify app; its client secret signs that store's webhooks and admin links.
export function clientSecretFor(key) {
  const suffix = key === "house" ? "" : "_" + key.toUpperCase();
  return process.env["SHOPIFY_CLIENT_SECRET" + suffix] || process.env.SHOPIFY_CLIENT_SECRET || "";
}
