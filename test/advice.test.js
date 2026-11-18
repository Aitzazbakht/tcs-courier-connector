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

import { buildAdviceBody, adviceAnswer, ANSWERS } from "../lib/advice.js";

test("answer bodies match TCS's action ids", () => {
  assert.deepEqual([ANSWERS.same, ANSWERS.edited, ANSWERS.new, ANSWERS.hfc].map((a) => [a.actionid, a.actiondetailid]), [[1, 5], [1, 2], [1, 3], [1, 4]]);
  assert.deepEqual([ANSWERS.rts.actionid, ANSWERS.rts.actiondetailid], [2, 1]);
  const b = buildAdviceBody({ cn: "173020115689", ticket: 88095865, answer: "same", remarks: "customer confirmed" });
  assert.deepEqual(b, { consignmentno: "173020115689", ticketno: 88095865, actionid: 1, actiondetailid: 5, deliveryaddress: "", revisedphoneno: "", remarks: "customer confirmed" });
});
test("a new or edited address is required and phone is checked", () => {
  assert.throws(() => buildAdviceBody({ cn: "173020115689", ticket: 1, answer: "new", address: "short" }), /full new address/);
  const b = buildAdviceBody({ cn: "173020115689", ticket: 1, answer: "new", address: "House 5, Street 2, Sector G-10/3, Islamabad", phone: "0300 1234567" });
  assert.equal(b.actiondetailid, 3); assert.equal(b.revisedphoneno, "03001234567"); assert.match(b.deliveryaddress, /G-10/);
  assert.throws(() => buildAdviceBody({ cn: "173020115689", ticket: 1, answer: "same", phone: "12" }), /phone/);
  assert.throws(() => buildAdviceBody({ cn: "1", ticket: 1, answer: "same" }), /parcel number/);
  assert.throws(() => buildAdviceBody({ cn: "173020115689", ticket: 0, answer: "rts" }), /ticket number/);
  assert.throws(() => buildAdviceBody({ cn: "173020115689", ticket: 1, answer: "nope" }), /Pick one/);
});
test("nothing is sent without confirmation", async () => {
  await assert.rejects(() => adviceAnswer({ cn: "173020115689", ticket: 88095865, answer: "rts" }), /Confirm/);
});
