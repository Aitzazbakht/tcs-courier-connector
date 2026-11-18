import { test } from "node:test";
import assert from "node:assert/strict";
import { stuckBand, stuckDays } from "../lib/inprocess.js";

test("days since booking", () => {
  assert.equal(stuckDays("2026-11-10", "2026-11-18"), 8);
  assert.equal(stuckDays("2026-11-18", "2026-11-18"), 0);
  assert.equal(stuckDays("2026-11-19", "2026-11-18"), 0);
  assert.equal(stuckDays("", "2026-11-18"), 0);
});
test("colour bands: 0-3 green, 4-5 amber, 6-9 red, 10+ whole row red", () => {
  const b = (n) => stuckBand(n);
  assert.deepEqual([0, 1, 2, 3].map(b), ["ok", "ok", "ok", "ok"]);
  assert.deepEqual([4, 5].map(b), ["warn", "warn"]);
  assert.deepEqual([6, 7, 9].map(b), ["bad", "bad", "bad"]);
  assert.deepEqual([10, 11, 30].map(b), ["crit", "crit", "crit"]);
});

test("day of the last TCS status change", async () => {
  const { whenDay } = await import("../lib/inprocess.js");
  assert.equal(whenDay("Thursday Nov 12, 2026 14:30"), "2026-11-12");
  assert.equal(whenDay("Nov 5, 2026 01:10"), "2026-11-05");
  assert.equal(whenDay(""), "");
  assert.equal(whenDay("not a date"), "");
});
