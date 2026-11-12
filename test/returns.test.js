// Return orders tab: reasons from TCS tracking, status tags, the rebooked copy of an order, and the whole list.
import test from "node:test";
import assert from "node:assert/strict";
Object.assign(process.env, { TCS_BEARER_TOKEN: "b", TCS_USERNAME: "u", TCS_PASSWORD: "p", CONNECTOR_KEY: "k", SHOPIFY_ACCESS_TOKEN: "t", SHOPIFY_SHOP: "house.myshopify.com", SHOPIFY_SHOP_HERBS: "" });
const { reasonOfTrack, statusOfTags, tagForStatus, buildRebookInput, REASONS, listReturns, setReturnStatus, rebookReturn } = await import("../lib/returns.js");

test("reason codes: refusal wins, TCS codes and text map to short codes", () => {
  assert.equal(reasonOfTrack({ deliveryinfo: [{ code: "RS", status: "Returned to shipper" }, { code: "HN", status: "Consignee not home" }, { code: "RD", status: "Refused to accept" }] }).code, "RD");
  assert.equal(reasonOfTrack({ deliveryinfo: [{ code: "RS", status: "Returned" }, { code: "BA", status: "x" }] }).code, "BA");
  assert.equal(reasonOfTrack({ checkpoints: [{ status: "Shipment returned" }, { status: "Mobile switched off" }] }).code, "NR");
  assert.equal(reasonOfTrack({ checkpoints: [{ status: "Order cancelled by customer" }] }).code, "CC");
  const none = reasonOfTrack({ checkpoints: [{ status: "Arrived at hub" }] });
  assert.equal(none.code, "OT"); assert.equal(none.label, REASONS.OT);
  assert.equal(reasonOfTrack(null).code, "OT");
});

test("status tags: presets, custom text, one tag, and clearing", () => {
  assert.deepEqual(statusOfTags(["tcs-booked", "ret-st:Reorder Confirm"]), { key: "reorder", text: "reorder confirm" });
  assert.deepEqual(statusOfTags(["ret-st:will call after Eid"]), { key: "custom", text: "will call after Eid" });
  assert.deepEqual(statusOfTags(["x"]), { key: "", text: "" });
  assert.equal(tagForStatus("contacted"), "ret-st:contacted");
  assert.equal(tagForStatus("dontneed"), "ret-st:dont need");
  assert.equal(tagForStatus("custom", "  call, tomorrow\n"), "ret-st:call tomorrow");
  assert.equal(tagForStatus(""), "");
  assert.throws(() => tagForStatus("custom", "   "), /Type the status/);
  assert.throws(() => tagForStatus("bogus"), /Unknown status/);
});

test("rebook input copies items, prices, address, confirms on WhatsApp and tags the copy", () => {
  const o = { id: "gid://shopify/Order/123", name: "#4335", phone: "03001112233", currencyCode: "PKR",
    shippingAddress: { firstName: "Saad", lastName: "Qureshi", address1: "House 1", address2: "", city: "Lahore", province: null, zip: null, countryCodeV2: "PK", phone: "03001112233" },
    shippingLines: { nodes: [{ title: "Delivery", discountedPriceSet: { shopMoney: { amount: "200.0" } } }, { title: "Free", discountedPriceSet: { shopMoney: { amount: "0.0" } } }] },
    lineItems: { nodes: [{ title: "Soap", quantity: 2, variant: { id: "gid://shopify/ProductVariant/1" }, discountedUnitPriceSet: { shopMoney: { amount: "900.00" } } }, { title: "Gift wrap", quantity: 1, sku: "GW", requiresShipping: false, variant: null, discountedUnitPriceSet: { shopMoney: { amount: "150" } } }] } };
  const i = buildRebookInput(o);
  assert.deepEqual(i.tags, ["wa-confirmed", "rebooked", "rebook-of:#4335"]);
  assert.equal(i.financialStatus, "PENDING");
  assert.equal(i.lineItems[0].variantId, "gid://shopify/ProductVariant/1");
  assert.equal(i.lineItems[0].priceSet.shopMoney.amount, "900.00");
  assert.equal(i.lineItems[1].title, "Gift wrap"); assert.equal(i.lineItems[1].requiresShipping, false);
  assert.equal(i.shippingLines.length, 1); assert.equal(i.shippingLines[0].priceSet.shopMoney.amount, "200.00");
  assert.equal(i.shippingAddress.city, "Lahore"); assert.equal(i.shippingAddress.countryCode, "PK");
  assert.equal(i.phone, "+923001112233"); assert.equal(i.shippingAddress.phone, "+923001112233"); assert.equal(i.customer, undefined);
  assert.equal(buildRebookInput({ ...o, phone: "123", shippingAddress: { ...o.shippingAddress, phone: "abc" } }).phone, undefined);
  assert.equal(i.sourceIdentifier, "rebook-123");
});

// ---- the whole flow against fake TCS and Shopify ----
const cn = "776412345601", cn2 = "776412345602";
const tags = { 1: ["tcs-booked", "TCS-" + cn], 2: ["tcs-booked", "TCS-" + cn2, "ret-st:contacted"] };
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url), body = init.body ? JSON.parse(init.body) : {};
  const json = (o) => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => o, text: async () => JSON.stringify(o) });
  if (/authentication\/token/.test(u)) return json({ accesstoken: "at", expiry: "2099-01-01" });
  if (/GetDynamicTrackDetail/.test(u)) return json({ shipmentinfo: [{ consignee: "Saad Qureshi", destination: "LAHORE" }], deliveryinfo: [{ code: "RS", status: "Returned" }, { code: "RD", status: "Refused" }], checkpoints: [] });
  if (/cnbulkinquiry|bulk/i.test(u)) return json({ detail: [{ cnno: cn, cnstatus: "RS", bookingdate: "05/11/2026", destinationcode: "LHE", codamount: 2400 }, { cnno: cn2, cnstatus: "RT", bookingdate: "06/11/2026", destinationcode: "KHI", codamount: 1500 }, { cnno: "776412345603", cnstatus: "OK", bookingdate: "06/11/2026", destinationcode: "ISB", codamount: 900 }, { cnno: "776412345604", cnstatus: "RS", bookingdate: "15/10/2026", destinationcode: "LHE", codamount: 700 }, { cnno: "776412345605", cnstatus: "RS", bookingdate: "12/11/2026", destinationcode: "LHE", codamount: 800 }] });
  if (/graphql/.test(u)) {
    const q = body.query || "";
    calls.push(q.slice(0, 40));
    if (/orders\(first/.test(q)) return json({ data: { orders: { pageInfo: { hasNextPage: false }, nodes: [
      { id: "gid://shopify/Order/1", name: "#4335", createdAt: "2026-11-05T08:00:00Z", tags: tags[1], fulfillments: [{ createdAt: "2026-11-05T09:00:00Z" }], phone: "0300111", totalPriceSet: { shopMoney: { amount: "2400" } }, shippingAddress: { name: "Saad Qureshi", address1: "House 1", city: "Lahore", phone: "0300111" }, lineItems: { nodes: [{ title: "Soap", quantity: 2, variantTitle: null }] } },
      { id: "gid://shopify/Order/2", name: "#4336", createdAt: "2026-11-06T08:00:00Z", tags: tags[2], fulfillments: [{ createdAt: "2026-11-06T08:00:00Z" }], totalPriceSet: { shopMoney: { amount: "1500" } }, shippingAddress: { name: "Bilal", address1: "Flat 2", city: "Karachi" }, lineItems: { nodes: [{ title: "Tea", quantity: 1, variantTitle: "100g" }] } },
      { id: "gid://shopify/Order/4", name: "#100", createdAt: "2026-10-15T08:00:00Z", tags: ["TCS-776412345604"], fulfillments: [{ createdAt: "2026-10-15T08:00:00Z" }], totalPriceSet: { shopMoney: { amount: "700" } }, shippingAddress: { name: "Old", city: "Lahore" }, lineItems: { nodes: [{ title: "Old", quantity: 1 }] } },
      { id: "gid://shopify/Order/5", name: "#5000", createdAt: "2026-11-12T08:00:00Z", tags: ["TCS-776412345605"], fulfillments: [{ createdAt: "2026-11-12T08:00:00Z" }], totalPriceSet: { shopMoney: { amount: "800" } }, shippingAddress: { name: "Late", city: "Lahore" }, lineItems: { nodes: [{ title: "Late", quantity: 1 }] } }] } } });
    if (/query Order\(/.test(q)) return json({ data: { order: { id: body.variables.id, tags: tags[2] } } });
    if (/query R\(/.test(q) && /customer/.test(q)) return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ errors: [{ message: "Access denied for customer field. Required access: read_customers" }] }), text: async () => "" };
    if (/query R\(/.test(q)) return json({ data: { order: { id: "gid://shopify/Order/1", name: "#4335", tags: tags[1], phone: "03001112233", currencyCode: "PKR", shippingAddress: { firstName: "Saad", lastName: "Qureshi", address1: "House 1", city: "Lahore", countryCodeV2: "PK" }, shippingLines: { nodes: [] }, lineItems: { nodes: [{ title: "Soap", quantity: 2, variant: { id: "gid://shopify/ProductVariant/1" }, discountedUnitPriceSet: { shopMoney: { amount: "1200" } } }] } } } });
    if (/customers\(first/.test(q)) { calls.push("FIND " + body.variables.q); return json({ data: { customers: { nodes: [] } } }); }
    if (/customerCreate/.test(q)) { calls.push("NEWCUST " + body.variables.i.phone); return json({ data: { customerCreate: { customer: { id: "gid://shopify/Customer/77" }, userErrors: [] } } }); }
    if (/orderCreate/.test(q)) { calls.push("CREATE " + JSON.stringify(body.variables.order.tags)); calls.push("CUST " + (body.variables.order.customer?.toAssociate?.id || "none")); return json({ data: { orderCreate: { order: { id: "gid://shopify/Order/99", name: "#4400", totalPriceSet: { shopMoney: { amount: "2400.00" } } }, userErrors: [] } } }); }
    if (/tagsAdd/.test(q)) { calls.push("ADD " + body.variables.tags.join("|")); return json({ data: { tagsAdd: { userErrors: [] } } }); }
    if (/tagsRemove/.test(q)) { calls.push("REMOVE " + body.variables.tags.join("|")); return json({ data: { tagsRemove: { userErrors: [] } } }); }
  }
  throw new Error("unexpected fetch " + u);
};

test("list: returned parcels only, matched to their orders, with reasons, status and amounts", async () => {
  const r = await listReturns({ from: "2026-10-01", to: "2026-11-10" });
  assert.equal(r.from, "2026-10-21", "nothing before the start day is shown");
  assert.equal(r.rows.length, 2);
  const a = r.rows.find((x) => x.cn === cn), b = r.rows.find((x) => x.cn === cn2);
  assert.equal(a.order, "#4335"); assert.equal(a.amount, 2400); assert.equal(a.reason.code, "RD"); assert.equal(a.canBook, true);
  assert.equal(a.booked, "2026-11-05"); assert.equal(b.booked, "2026-11-06");
  assert.equal(r.rows.some((z) => z.cn === "776412345604" || z.cn === "776412345605"), false, "booked before the start day or after the range");
  assert.equal(a.products, "Soap x2"); assert.equal(a.tcsState, "Returned");
  assert.equal(b.status.key, "contacted"); assert.equal(b.tcsState, "Return in transit"); assert.equal(b.products, "Tea (100g) x1");
});

test("status change replaces the old tag; rebook creates the order and marks the old one", async () => {
  calls.length = 0;
  const s = await setReturnStatus("gid://shopify/Order/2", "reorder", "");
  assert.equal(s.status.key, "reorder");
  assert.ok(calls.includes("REMOVE ret-st:contacted") && calls.includes("ADD ret-st:reorder confirm"));
  calls.length = 0;
  const r = await rebookReturn("gid://shopify/Order/1");
  assert.equal(r.order, "#4400"); assert.equal(r.status.key, "rebooked");
  assert.ok(calls.some((c) => c === 'CREATE ["wa-confirmed","rebooked","rebook-of:#4335"]'));
  assert.ok(calls.includes("ADD ret-st:rebooked|rebooked-as:#4400"));
  assert.ok(calls.includes("FIND phone:+923001112233") && calls.includes("NEWCUST +923001112233"));
  assert.ok(calls.includes("CUST gid://shopify/Customer/77"), "the new order is linked to the customer");
  assert.equal(r.warning, "");
  tags[1] = ["tcs-booked", "TCS-" + cn, "ret-st:rebooked", "rebooked-as:#4400"];
});
