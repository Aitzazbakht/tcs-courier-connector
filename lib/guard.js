// Website blocking of devices that placed fake orders.
// Each browser gets a random code (_chd) from the storefront script; it travels with the order as a
// hidden line-item property / cart attribute. "Cancel & restock (fake)" adds that code to a block list,
// stored as a Chitral House shop metafield (no database). The storefront asks /api/guard?d=<code> and
// hides checkout buttons only on an exact match.
import * as shop from "./shopify.js";
import * as wa from "./whatsapp.js";

const LIST_KEY = "blocked_devices";
const SWITCH_KEY = "web_block";
export const ID_RE = /^[a-z0-9]{10,40}$/;

let cache = { at: 0, data: null, on: true };

export async function load(force = false) {
  if (!force && cache.data && Date.now() - cache.at < 20_000) return cache;
  const [b, s] = await Promise.all([shop.getSetting(LIST_KEY), shop.getSetting(SWITCH_KEY)]);
  let data;
  try { data = JSON.parse(b.value || "{}"); } catch { data = {}; }
  if (!data.devices || typeof data.devices !== "object") data.devices = {};
  cache = { at: Date.now(), data, on: s.value !== "false" }; // on unless switched off
  return cache;
}

async function save(data) {
  await shop.setSetting(LIST_KEY, JSON.stringify(data), "json");
  cache = { ...cache, at: Date.now(), data };
}

export async function setOn(on) {
  await shop.setSetting(SWITCH_KEY, on ? "true" : "false");
  cache = { ...cache, on: !!on };
  return !!on;
}

let waNum = { v: null, at: 0 };
async function orderNumber() {
  // Number blocked buyers are sent to on the website (Chitral House sales WhatsApp).
  return String(process.env.WA_ORDER_NUMBER || "923275851670").replace(/\D/g, "");
  if (waNum.v && Date.now() - waNum.at < 6 * 3600e3) return waNum.v;
  try {
    const p = await wa.phoneStatus();
    const v = String(p.display_phone_number || "").replace(/\D/g, "");
    if (v) waNum = { v, at: Date.now() };
  } catch {}
  return waNum.v;
}

// Storefront check. Anything unexpected answers "not blocked" (fail open).
export async function check(id, countVisit = false) {
  if (!ID_RE.test(String(id || ""))) return { b: false };
  const c = await load();
  if (!c.on || !c.data.devices[id]) return { b: false };
  if (countVisit) {
    try {
      const fresh = await load(true);
      const d = fresh.data.devices[id];
      if (d) { d.hits = (d.hits || 0) + 1; d.last = new Date().toISOString(); await save(fresh.data); }
    } catch {}
  }
  return { b: true, wa: await orderNumber() };
}

// Called (inside the order's store) after a fake order is cancelled.
export async function blockFromOrder(gid, storeKey, storeLabel) {
  const d = await shop.gql(
    `query O($id: ID!) { order(id: $id) { id name sourceName phone customAttributes { key value }
      lineItems(first: 50) { nodes { customAttributes { key value } } } shippingAddress { name phone city } } }`,
    { id: gid }
  );
  const o = d.order;
  if (!o) return { blocked: 0, note: "order not found" };
  if (o.sourceName && o.sourceName !== "web") return { blocked: 0, note: "not a website order, nothing to block" };
  const ids = new Set();
  for (const a of o.customAttributes || []) if (a.key === "_chd" && ID_RE.test(a.value)) ids.add(a.value);
  for (const li of o.lineItems?.nodes || []) for (const a of li.customAttributes || []) if (a.key === "_chd" && ID_RE.test(a.value)) ids.add(a.value);
  if (!ids.size) return { blocked: 0, note: "no device code on this order (placed before blocking was set up)" };
  const c = await load(true);
  const at = new Date().toISOString();
  for (const id of ids) {
    c.data.devices[id] = c.data.devices[id] || {
      order: o.name, store: storeKey, storeLabel,
      name: o.shippingAddress?.name || "", phone: o.shippingAddress?.phone || o.phone || "", city: o.shippingAddress?.city || "",
      at, hits: 0, last: null,
    };
  }
  await save(c.data);
  return { blocked: ids.size };
}

// Rows for the Blocked tab, one per fake order (a person may have several devices).
export async function list() {
  const c = await load(true);
  const groups = new Map();
  for (const [id, d] of Object.entries(c.data.devices)) {
    const k = `${d.store}|${d.order}`;
    const g = groups.get(k) || { key: k, order: d.order, store: d.store, storeLabel: d.storeLabel, name: d.name, phone: d.phone, city: d.city, at: d.at, hits: 0, last: null, ids: [] };
    g.ids.push(id);
    g.hits += d.hits || 0;
    if (d.last && (!g.last || d.last > g.last)) g.last = d.last;
    if (d.at < g.at) g.at = d.at;
    groups.set(k, g);
  }
  return { on: c.on, rows: [...groups.values()].sort((a, b) => String(b.at).localeCompare(String(a.at))) };
}

export async function unblock(ids) {
  const c = await load(true);
  let n = 0;
  for (const id of ids || []) if (c.data.devices[id]) { delete c.data.devices[id]; n++; }
  if (n) await save(c.data);
  return { removed: n };
}
