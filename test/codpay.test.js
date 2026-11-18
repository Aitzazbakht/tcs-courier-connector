import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCodPayments, waitBand, waitDays, blocks } from "../lib/codpay.js";

const row = (o) => ({ cn: "100", order: "1", booked: "01/11/2026", delivered: "03/11/2026", city: "LHE", status_code: "OK", status: "Delivered", paid: false, amount_paid: 0, delivery_charges: 210, fuel_surcharge: 10, osa_charges: 0, sales_tax: 31.5, whit: 60, payment_date: null, ...o });

test("wait bands: 0-7 normal, 8-12 amber, 13+ red", () => {
  assert.deepEqual([0, 7].map(waitBand), ["ok", "ok"]);
  assert.deepEqual([8, 12].map(waitBand), ["warn", "warn"]);
  assert.deepEqual([13, 30].map(waitBand), ["bad", "bad"]);
  assert.equal(waitDays("2026-11-10", "2026-11-18"), 8);
});
test("totals: paid, waiting (amount from withholding tax), returned, charges", () => {
  const r = buildCodPayments([
    row({ cn: "1" }),
    row({ cn: "2", paid: true, amount_paid: 3000, whit: 60, payment_date: "10/11/2026 03:52 PM" }),
    row({ cn: "3", status_code: "RS", status: "Returned to sender", delivered: "05/11/2026", whit: 0 }),
    row({ cn: "4", status_code: "", status: "In transit", delivered: "" , whit: 0 }),
    row({ cn: "5", delivered: "20/10/2026", whit: 100 }),
  ], "2026-11-18");
  const t = r.totals;
  assert.equal(t.parcels, 5); assert.equal(t.delivered, 3); assert.equal(t.returned, 1); assert.equal(t.transit, 1);
  assert.equal(t.paidCount, 1); assert.equal(t.paidAmount, 3000);
  assert.equal(t.waitingCount, 2); assert.equal(t.waitingAmount, 3000 + 5000); // 60/0.02 and 100/0.02
  assert.equal(t.late, 2); // 15 days and 29 days
  assert.equal(r.rows[0].cn, "5"); // longest wait first
  assert.equal(r.rows[0].band, "bad");
  assert.deepEqual(r.payments, [{ date: "2026-11-10", parcels: 1, amount: 3000, charges: 251.5 }]);
});

test("amount of an unpaid parcel comes from the booking list when TCS has no tax figure", () => {
  const r = buildCodPayments([row({ cn: "7", whit: 0, bookingValue: 4500 })], "2026-11-18");
  assert.equal(r.rows[0].cod, 4500); assert.equal(r.rows[0].codSource, "booking value");
  assert.equal(r.totals.waitingAmount, 4500);
});

test("10-day blocks line up on fixed days and stop at today", () => {
  const b = blocks("2026-11-05", "2026-11-18", "2026-11-18");
  assert.ok(b.length >= 2);
  assert.ok(b[0][0] <= "2026-11-05" && b[0][1] >= "2026-11-05");
  assert.equal(b[b.length - 1][1], "2026-11-18");
  for (const [a, e] of b) assert.ok(a <= e);
  assert.deepEqual(blocks("2026-11-18", "2026-11-18", "2026-11-18").length, 1);
});

test("delivered-but-unpaid parcels with no tracking history are set aside, not counted as waiting", () => {
  const rows = [row({ cn: "1", delivered: "05/10/2026", whit: 0 }), row({ cn: "2", delivered: "05/10/2026", whit: 0 }), row({ cn: "3", paid: true, amount_paid: 2000, payment_date: "10/11/2026 03:52 PM" })];
  const r = buildCodPayments(rows, "2026-11-18", new Set(["1"]));
  assert.equal(r.totals.waitingCount, 1); assert.equal(r.totals.noTrackingCount, 1);
  const n = r.rows.find((x) => x.cn === "1");
  assert.equal(n.group, "nodispatch"); assert.equal(n.waiting, false); assert.equal(n.days, null);
  assert.equal(r.totals.paidCount, 1); // a paid parcel is never set aside
  assert.equal(r.totals.late, 1);
});

test("delivered parcels the booking list shows with COD 0 are not waiting for money; unknown stays waiting", () => {
  const rows = [row({ cn: "1", whit: 0, bookingValue: 0 }), row({ cn: "2", whit: 0, bookingValue: null }), row({ cn: "3", whit: 0, bookingValue: 4500 })];
  const r = buildCodPayments(rows, "2026-11-18");
  assert.equal(r.rows.find((x) => x.cn === "1").group, "nocod");
  assert.equal(r.totals.noCodCount, 1);
  assert.equal(r.totals.waitingCount, 2); // the unknown one and the one with COD 4500
  assert.equal(r.totals.waitingAmount, 4500);
});
