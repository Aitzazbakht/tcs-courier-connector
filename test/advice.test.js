import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeTicket, adviceBand, ticketDay } from "../lib/advice.js";

test("ticket day and waiting bands", () => {
  assert.equal(ticketDay("2026-11-01 07:00 PM"), "2026-11-01");
  assert.equal(ticketDay(""), "");
  assert.deepEqual([0, 1].map(adviceBand), ["ok", "ok"]);
  assert.deepEqual([2, 3].map(adviceBand), ["warn", "warn"]);
  assert.deepEqual([4, 17].map(adviceBand), ["bad", "bad"]);
});
test("a TCS pending ticket is shaped for the page", () => {
  const r = shapeTicket({ consignmentno: " 173020115689 ", ticketno: 88095865, deliverystatus: "Not Collected – Self Collection", deliverydate: "2026-11-01 07:00 PM", remarks: "HFSA", consigneecell: "03459299960", origin: "ISLAMABAD", destination: "Bunair" }, "2026-11-18");
  assert.equal(r.cn, "173020115689"); assert.equal(r.days, 17); assert.equal(r.band, "bad"); assert.equal(r.destination, "Bunair");
});
