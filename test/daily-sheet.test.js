// The courier sheet only confirms a rider delivery that is dated on or after the day the order was placed.
import test from "node:test";
import assert from "node:assert/strict";
Object.assign(process.env, { SHOPIFY_ACCESS_TOKEN: "t", SHOPIFY_SHOP_HERBS: "" });
const { blockDay, dayFits } = await import("../lib/daily.js");

test("date blocks are read in the formats the sheet uses", () => {
  assert.equal(blockDay("9 Oct 2026"), "2026-10-09");
  assert.equal(blockDay("12 November 2026"), "2026-11-12");
  assert.equal(blockDay("3-Nov-2026"), "2026-11-03");
  assert.equal(blockDay("9/10/2026"), "2026-10-09");
  assert.equal(blockDay("rider amount"), null);
  assert.equal(blockDay(""), null);
});

test("an older sheet row cannot confirm a newer order", () => {
  assert.equal(dayFits("10 Oct 2026", "2026-11-12"), false, "delivered a month before the order existed");
  assert.equal(dayFits("12 Nov 2026", "2026-11-12"), true, "same day");
  assert.equal(dayFits("14 Nov 2026", "2026-11-12"), true, "a couple of days later");
  assert.equal(dayFits("20 Feb 2027", "2026-11-12"), false, "months later is somebody else's row");
  assert.equal(dayFits("", "2026-11-12"), true, "unreadable block: keep");
  assert.equal(dayFits("whatever", "2026-11-12"), true);
});
