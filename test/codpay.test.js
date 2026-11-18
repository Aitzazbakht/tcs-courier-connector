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
  assert.equal(r.payments.length, 1);
  assert.deepEqual({ date: r.payments[0].date, parcels: r.payments[0].parcels, amount: r.payments[0].amount, charges: r.payments[0].charges }, { date: "2026-11-10", parcels: 1, amount: 3000, charges: 251.5 });
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

import { billingWeek } from "../lib/codpay.js";
test("billing week is the Sunday-to-Saturday week before the payment day (matches TCS's 11 and 17 Nov payments)", () => {
  assert.deepEqual(billingWeek("2026-11-11"), { from: "2026-11-01", to: "2026-11-07" });
  assert.deepEqual(billingWeek("2026-11-17"), { from: "2026-11-08", to: "2026-11-14" });
  assert.deepEqual(billingWeek("2026-10-05"), { from: "2026-09-27", to: "2026-10-03" });
  assert.equal(billingWeek(""), null);
});
test("estimated deposit = COD paid - charges - returned charges - both taxes", () => {
  const rows = [
    row({ cn: "1", paid: true, amount_paid: 3000, whit: 60, delivered: "05/11/2026", payment_date: "11/11/2026 03:52 PM" }),
    row({ cn: "2", paid: true, amount_paid: 2000, whit: 40, delivered: "06/11/2026", payment_date: "11/11/2026 03:52 PM" }),
    row({ cn: "3", status_code: "RS", status: "Returned to sender", delivered: "04/11/2026", whit: 0 }),
  ];
  const r = buildCodPayments(rows, "2026-11-18");
  const p = r.payments[0];
  // charges per parcel = 210 + 10 + 0 + 31.5 = 251.5
  assert.equal(p.amount, 5000); assert.equal(p.charges, 503); assert.equal(p.returnedCharges, 251.5); assert.equal(p.tax, 200);
  assert.equal(p.estimatedDeposit, Math.round(5000 - 503 - 251.5 - 200));
  assert.equal(p.weekFrom, "2026-11-01");
});

test("the next payment is the week after the last paid one: waiting COD minus charges, this week's returns and 4% tax", () => {
  const rows = [
    row({ cn: "1", paid: true, amount_paid: 3000, whit: 60, delivered: "13/11/2026", payment_date: "17/11/2026 03:52 PM" }),
    row({ cn: "2", delivered: "14/11/2026", whit: 0, bookingValue: 4000 }), // carried over from last week, still unpaid
    row({ cn: "3", delivered: "16/11/2026", whit: 0, bookingValue: 6000 }), // delivered this week
    row({ cn: "4", status_code: "RS", status: "Returned to sender", delivered: "17/11/2026", whit: 0 }),
    row({ cn: "5", delivered: "16/11/2026", whit: 0, bookingValue: null }), // amount unknown, left out of the sum
  ];
  const u = buildCodPayments(rows, "2026-11-18").upcoming;
  assert.equal(u.weekFrom, "2026-11-15"); assert.equal(u.weekTo, "2026-11-21"); assert.equal(u.expectedPay, "2026-11-24");
  assert.equal(u.parcels, 2); assert.equal(u.carriedOver, 1); assert.equal(u.thisWeek, 1); assert.equal(u.unknownAmount, 1);
  assert.equal(u.cod, 10000); assert.equal(u.charges, 503); assert.equal(u.returnedCharges, 251.5); assert.equal(u.tax, 400);
  assert.equal(u.estimatedDeposit, Math.round(10000 - 503 - 251.5 - 400));
  assert.equal(buildCodPayments([row({ cn: "9", delivered: "16/11/2026", bookingValue: 1000 })], "2026-11-18").upcoming, null);
});
