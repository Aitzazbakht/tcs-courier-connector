// Sales report: rebooked return parcels are not sales; they get their own section. Fixture: one normal and one rebooked order per store.
import test from "node:test";
import assert from "node:assert/strict";
Object.assign(process.env, { TCS_BEARER_TOKEN: "b", TCS_USERNAME: "u", TCS_PASSWORD: "p", CONNECTOR_KEY: "k", SHOPIFY_ACCESS_TOKEN: "t", SHOPIFY_SHOP: "house.myshopify.com", SHOPIFY_SHOP_HERBS: "" });
const { isRebooked, rebookOf } = await import("../lib/rebook.js");
const { buildSales, normHouse } = await import("../lib/sales.js");
const { shapeOrder } = await import("../lib/herbs.js");

const raw = (name, total, extra = {}) => ({
  name, createdAt: "2026-11-10T08:00:00Z", cancelledAt: null, test: false, tags: [], note: "", paymentGatewayNames: ["Cash on Delivery (COD)"],
  totalPriceSet: { shopMoney: { amount: String(total) } }, subtotalPriceSet: { shopMoney: { amount: String(total) } }, totalDiscountsSet: { shopMoney: { amount: "0" } },
  totalShippingPriceSet: { shopMoney: { amount: "0" } },
  lineItems: { nodes: [{ title: "Shilajit 10g", variantTitle: "", quantity: 1, originalUnitPriceSet: { shopMoney: { amount: String(total) } } }] }, ...extra,
});

test("detection: tag rebooked, tag rebook-of:, or note; rebookOf from tag then note", () => {
  assert.equal(isRebooked({ tags: ["Rebooked"] }), true);
  assert.equal(isRebooked({ tags: ["rebook-of:#52111"] }), true);
  assert.equal(isRebooked({ tags: [], note: "Rebooked from #52111 (returned by TCS)" }), true);
  assert.equal(isRebooked({ tags: ["tcs-booked"], note: "please call" }), false);
  assert.equal(rebookOf({ tags: ["rebooked", "rebook-of:#52111"], note: "Rebooked from #99999 (returned by TCS)" }), "52111");
  assert.equal(rebookOf({ tags: ["rebooked"], note: "Rebooked from #26880 (returned by TCS)" }), "26880");
  assert.equal(rebookOf({ tags: ["rebooked"], note: "" }), null);
});

test("herbs feed order carries rebooked, rebook_of and note", () => {
  const n = shapeOrder(raw("#26950", 2550, { tags: ["rebooked", "rebook-of:#26880"], note: "Rebooked from #26880 (returned by TCS)" }));
  assert.equal(n.rebooked, true); assert.equal(n.rebook_of, "26880"); assert.match(n.note, /^Rebooked from/);
  const p = shapeOrder(raw("#26951", 1550));
  assert.equal(p.rebooked, false); assert.equal(p.rebook_of, null);
});

test("sales totals exclude rebooked orders; the rebooked section lists them", () => {
  const house = [normHouse(raw("#52500", 1550)), normHouse(raw("#52501", 4500, { tags: ["rebooked", "rebook-of:#52111"], note: "Rebooked from #52111 (returned by TCS)" }))];
  const herbs = [shapeOrder(raw("#26950", 2550)), shapeOrder(raw("#26951", 1550, { tags: ["rebooked", "rebook-of:#26880"], paymentGatewayNames: ["Prepaid"] }))];
  const r = buildSales({ date: "2026-11-10", house, herbs });
  assert.equal(r.kpi.totalSales, 1550 + 2550);
  assert.equal(r.kpi.orders, 2);
  assert.equal(r.kpi.aov, 2050);
  assert.equal(r.kpi.gross, 1550 + 2550);
  assert.equal(r.channels.reduce((s, c) => s + c.sales, 0), 4100);
  assert.equal(r.orders.length, 2);
  assert.ok(!r.orders.some((o) => /52501|26951/.test(o.order)));
  assert.equal(r.products.reduce((s, p) => s + p.units, 0), 2);
  assert.equal(r.rebooked.count, 2); assert.equal(r.rebooked.total, 6050);
  assert.deepEqual([r.rebooked.house.orders, r.rebooked.house.total, r.rebooked.herbs.orders, r.rebooked.herbs.total], [1, 4500, 1, 1550]);
  assert.deepEqual([r.rebooked.cod.orders, r.rebooked.cod.total, r.rebooked.prepaid.orders, r.rebooked.prepaid.total], [1, 4500, 1, 1550]);
  const row = r.rebooked.rows.find((x) => x.order === "#52501");
  assert.equal(row.original, "#52111"); assert.equal(row.store, "Chitral House"); assert.equal(row.payment, "COD"); assert.equal(row.total, 4500);
});

test("no rebooked orders: empty section", () => {
  const r = buildSales({ date: "2026-11-10", house: [normHouse(raw("#52500", 1550))], herbs: [] });
  assert.equal(r.rebooked.count, 0); assert.deepEqual(r.rebooked.rows, []);
});
