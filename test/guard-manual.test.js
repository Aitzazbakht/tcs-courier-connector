// Blocking a customer by hand from the Blocked tab: the order number finds the order, the order carries the device code.
import test from "node:test";
import assert from "node:assert/strict";
Object.assign(process.env, { SHOPIFY_ACCESS_TOKEN: "t", SHOPIFY_SHOP: "house.myshopify.com", SHOPIFY_SHOP_HERBS: "herbs.myshopify.com", SHOPIFY_CLIENT_ID: "i", SHOPIFY_CLIENT_SECRET: "s" });
const meta = new Map(); // key -> value, on the house shop
const orders = { house: [], herbs: [] };
globalThis.fetch = async (url, init = {}) => {
  const u = String(url), json = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
  if (/oauth\/access_token/.test(u)) return json({ access_token: "h", expires_in: 3600 });
  const b = JSON.parse(init.body || "{}"), q = b.query || "", store = /herbs/.test(u) ? "herbs" : "house";
  if (/query S\(/.test(q)) return json({ data: { shop: { id: "gid://shopify/Shop/1", metafield: meta.has(b.variables.k) ? { value: meta.get(b.variables.k) } : null } } });
  if (/metafieldsSet/.test(q)) { const m = b.variables.m[0]; meta.set(m.key, m.value); return json({ data: { metafieldsSet: { userErrors: [] } } }); }
  if (/query F\(/.test(q)) return json({ data: { orders: { nodes: orders[store].filter((o) => "name:" + o.name === "name:" + String(b.variables.q).replace("name:", "")) } } });
  throw new Error("unexpected " + q.slice(0, 40));
};
const { blockManual, list, deviceIdsOf, unblock } = await import("../lib/guard.js");

const web = (name, ids, extra = {}) => ({ id: "gid://shopify/Order/" + name.slice(1), name, sourceName: "web", phone: "0300111", customAttributes: ids[0] ? [{ key: "_chd", value: ids[0] }] : [], lineItems: { nodes: ids[1] ? [{ customAttributes: [{ key: "_chd", value: ids[1] }] }] : [{ customAttributes: [] }] }, shippingAddress: { name: "Order Name", phone: "0300111", city: "Lahore" }, ...extra });

test("device codes are read from the order and from its line items", () => {
  assert.deepEqual(deviceIdsOf(web("#1", ["abcdefghij12", "klmnopqrst34"])).sort(), ["abcdefghij12", "klmnopqrst34"]);
  assert.deepEqual(deviceIdsOf(web("#1", [])), []);
  assert.deepEqual(deviceIdsOf({ customAttributes: [{ key: "_chd", value: "BAD CODE" }] }), []);
});

test("block by hand: finds the old order, stores what was typed, shows up in the Blocked list as manual", async () => {
  orders.house = [web("#52379", ["abcdefghij12", "klmnopqrst34"])];
  const r = await blockManual({ order: "# 52379", name: "  Typed   Name ", phone: "0321 1234567", store: "" });
  assert.equal(r.blocked, 2); assert.equal(r.order, "#52379"); assert.equal(r.name, "Typed Name"); assert.equal(r.phone, "0321 1234567");
  const l = await list();
  assert.equal(l.rows.length, 1); assert.equal(l.rows[0].manual, true); assert.equal(l.rows[0].ids.length, 2); assert.equal(l.rows[0].name, "Typed Name");
  const again = await blockManual({ order: "52379" });
  assert.deepEqual([again.blocked, again.already], [0, 2]);
});

test("name and phone left empty fall back to the order's own", async () => {
  orders.herbs = [web("#2001", ["zzzzzzzzzz01"])];
  const r = await blockManual({ order: "2001" });
  assert.equal(r.blocked, 1); assert.equal(r.name, "Order Name"); assert.equal(r.phone, "0300111"); assert.equal(r.storeLabel, "Chitral Herbs");
});

test("problems are explained: not found, both stores, no device code, not a website order", async () => {
  await assert.rejects(() => blockManual({ order: "99999" }), /#99999 was not found in either store/);
  await assert.rejects(() => blockManual({ order: "" }), /Type the order number/);
  orders.house = [web("#3000", ["house0000001"])]; orders.herbs = [web("#3000", ["herbs0000001"])];
  await assert.rejects(() => blockManual({ order: "3000" }), /both stores/);
  assert.equal((await blockManual({ order: "3000", store: "herbs" })).storeLabel, "Chitral Herbs");
  orders.house = [web("#4000", [])];
  const none = await blockManual({ order: "4000", store: "house" });
  assert.equal(none.blocked, 0); assert.match(none.note, /no device code/);
  orders.house = [web("#5000", ["abcdefghij99"], { sourceName: "pos" })];
  assert.match((await blockManual({ order: "5000", store: "house" })).note, /not a website order/);
});

test("unblocking a manual block works like any other", async () => {
  const l = await list(); const row = l.rows.find((x) => x.order === "#52379");
  assert.equal((await unblock(row.ids)).removed, 2);
});
