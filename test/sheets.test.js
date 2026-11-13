import { test } from "node:test";
import assert from "node:assert/strict";
import { setKv } from "../lib/kvstore.js";
import * as S from "../lib/sheets.js";

function fakeRedis() {
  const kv = new Map();
  return ([c, k, a, b]) => {
    if (c === "GET") return kv.has(k) ? kv.get(k) : null;
    if (c === "SET") { kv.set(k, a); return "OK"; }
    if (c === "DEL") { kv.delete(k); return 1; }
    if (c === "LPUSH") { const l = kv.get(k) || []; l.unshift(a); kv.set(k, l); return l.length; }
    if (c === "LTRIM") { kv.set(k, (kv.get(k) || []).slice(+a, +b + 1)); return "OK"; }
    if (c === "LRANGE") return (kv.get(k) || []).slice(+a, +b + 1);
    throw new Error("cmd " + c);
  };
}

test("edit, history, revert, rows", async () => {
  setKv(fakeRedis());
  const s = await S.createSheet("Test", "Ali");
  const t = s.tabs[0].id;
  await S.editCells(s.id, t, [{ r: 0, c: 0, v: "Name" }, { r: 3, c: 2, v: "x" }], "Ali");
  let g = await S.getTab(s.id, t);
  assert.equal(g.rows[0][0], "Name"); assert.equal(g.rows[3][2], "x"); assert.equal(g.rows.length, 4);
  assert.equal((await S.sheetsList()).sheets[0].editedBy, "Ali");
  await S.editCells(s.id, t, [{ r: 0, c: 0, v: "Nom" }], "Sara");
  let h = (await S.history(s.id)).entries;
  assert.equal(h[0].u, "Sara"); assert.equal(h[0].o, "Name");
  await S.revert(s.id, h[0].at, "Ali");
  assert.equal((await S.getTab(s.id, t)).rows[0][0], "Name");
  await S.deleteRows(s.id, t, 3, 1, "Ali");
  assert.equal((await S.getTab(s.id, t)).rows.length, 3);
  h = (await S.history(s.id)).entries;
  await S.revert(s.id, h[0].at, "Ali");
  assert.equal((await S.getTab(s.id, t)).rows[3][2], "x");
  await S.insertRows(s.id, t, 1, 2, "Ali");
  assert.equal((await S.getTab(s.id, t)).rows.length, 6);
});
test("tabs and limits", async () => {
  setKv(fakeRedis());
  const s = await S.createSheet("T", "A");
  const s2 = await S.addTab(s.id, "Second", "A");
  assert.equal(s2.tabs.length, 2);
  await S.deleteTab(s.id, s2.tabs[1].id, "A");
  await assert.rejects(() => S.deleteTab(s.id, s.tabs[0].id, "A"), /at least one/);
  await assert.rejects(() => S.editCells(s.id, s.tabs[0].id, [{ r: 99999, c: 0, v: "x" }], "A"), /limit/);
});
test("google tab names", () => {
  const h = '<li id="sheet-button-123" class="x"><a href="#gid=123">March</a></li><a href="?gid=0">';
  assert.deepEqual(S.googleTabs(h).find((x) => x[0] === "123"), ["123", "March"]);
});

test("courier sheet kind is read from the app copy", async () => {
  setKv(fakeRedis());
  const s = await S.createSheet("Courier", "A", "courier");
  const t = s.tabs[0].id;
  const rows = [["9 Nov 2026", "", "", ""], ["CONSIGNEE NAME", "AMOUNT", "STATUS", "order no"], ["TEST PERSON", "1500", "DELIVERD", "123"]];
  await S.editCells(s.id, t, rows.flatMap((r, i) => r.map((v, c) => ({ r: i, c, v }))), "A");
  const o = await S.rowsOfKind("courier");
  assert.equal(o.tabs[0].rows[2][0], "TEST PERSON");
  assert.equal(await S.rowsOfKind("advice"), null);
  const adv = await import("../lib/shipperadvice.js");
  const ss = await S.createSheet("Advice", "A", "advice");
  await S.editCells(ss.id, ss.tabs[0].id, [{ r: 0, c: 0, v: "775492649540" }, { r: 0, c: 1, v: "rts" }], "A");
  const a = await adv.adviceRts({ refresh: true });
  assert.ok(a.own && a.map.has("775492649540"));
});
