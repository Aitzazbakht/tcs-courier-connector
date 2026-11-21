import test from "node:test";
import assert from "node:assert/strict";
process.env.META_APP_SECRET = "test-secret-not-real";
delete process.env.WINDSOR_API_KEY;
const { setKv } = await import("../lib/kvstore.js");
const meta = await import("../lib/meta.js");
const { adSpend, adCampaigns } = await import("../lib/ads.js");

const store = new Map();
setKv(async (a) => { const [c, k, v] = a; if (c === "GET") return store.has(k) ? store.get(k) : null; if (c === "SET") { store.set(k, v); return "OK"; } if (c === "DEL") { store.delete(k); return 1; } return null; });

test("saved token is encrypted and only the right secret opens it", () => {
  const sealed = meta.seal({ token: "EAAB-secret-token", n: 1 });
  assert.ok(!sealed.includes("EAAB"));
  assert.deepEqual(meta.unseal(sealed), { token: "EAAB-secret-token", n: 1 });
  assert.equal(meta.unseal(sealed.slice(0, -4) + "AAAA"), null);
  process.env.META_APP_SECRET = "another-secret"; assert.equal(meta.unseal(sealed), null); process.env.META_APP_SECRET = "test-secret-not-real";
});
test("sign-in state: valid once issued, refused when forged or old", () => {
  const s = meta.makeState(); assert.ok(meta.stateOk(s));
  assert.ok(!meta.stateOk(s.slice(0, -2) + "xx"));
  assert.ok(!meta.stateOk("a.b.c")); assert.ok(!meta.stateOk(""));
  assert.ok(!meta.stateOk(s, Date.now() + 11 * 60 * 1000));
});
test("account pick: exact ids plus name match, with skips", () => {
  const acc = [{ id: "1", name: "Chitral House" }, { id: "2", name: "Gummiotics" }, { id: "3", name: "Markhor herbs" }, { id: "9", name: "Other" }];
  const got = meta.pickAccounts(acc, { ids: ["9"], nameRe: /chitral|markhor/i, skipNameRe: /gummiotics/i });
  assert.deepEqual(got.map((a) => a.id).sort(), ["1", "3", "9"]);
  assert.deepEqual(meta.pickAccounts(acc, { ids: ["2"], skipIds: ["2"] }), []);
});

const realFetch = globalThis.fetch;
const json = (o, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => o });
function fakeGraph(log) {
  globalThis.fetch = async (url) => {
    const u = String(url); log.push(u);
    if (/\/act_1331709170964362\/insights/.test(u) && /campaign/.test(u)) return json({ data: [{ campaign_id: "c1", campaign_name: "Gummies", spend: "1500.4", actions: [{ action_type: "omni_purchase", value: "6" }], action_values: [{ action_type: "omni_purchase", value: "21000" }] }] });
    if (/\/act_1331709170964362\/insights/.test(u)) return json({ data: [{ date_start: "2026-11-18", spend: "1200.5" }, { date_start: "2026-11-19", spend: "300" }] });
    if (/insights/.test(u)) return json({ data: [] });
    throw new Error("unexpected call " + u);
  };
}
async function connected() {
  store.set("cs:meta", JSON.stringify(meta.seal({ token: "tok", name: "Hasnain", accounts: [{ id: "1331709170964362", name: "Myadaccount" }, { id: "1327473458069144", name: "Not use" }, { id: "5", name: "Gummiotics" }], expiresAt: Date.now() + 1e9, at: 1 })));
}

test("ad spend comes from Meta directly when connected (no Windsor key)", async () => {
  await connected(); const log = []; fakeGraph(log);
  try {
    const r = await adSpend("2026-11-18", "2026-11-19");
    assert.equal(r.amounts.metaHouse, 1501); assert.equal(r.status.metaHouse.ok, true); assert.match(r.status.metaHouse.note, /Meta/);
    assert.ok(log.every((u) => /graph\.facebook\.com/.test(u)));
    assert.ok(!log.some((u) => /act_5\//.test(u)), "Gummiotics account is never read");
    assert.equal(r.daily["2026-11-18"], 1201);
  } finally { globalThis.fetch = realFetch; }
});
test("campaigns come from Meta directly with purchases and value", async () => {
  await connected(); const log = []; fakeGraph(log);
  try {
    const r = await adCampaigns("2026-11-18");
    const row = r.rows.find((x) => x.key === "metaHouse");
    assert.equal(row.campaign, "Gummies"); assert.equal(row.spend, 1500); assert.equal(row.purchases, 6); assert.equal(row.value, 21000); assert.equal(row.roas, 14);
  } finally { globalThis.fetch = realFetch; }
});
test("not connected and no Windsor key: a clear message", async () => {
  store.clear();
  await assert.rejects(adSpend("2026-11-18"), /Connect Meta Ads/);
});
test("expired Meta login is reported, not silently empty", async () => {
  store.set("cs:meta", JSON.stringify(meta.seal({ token: "t", name: "x", accounts: [{ id: "1331709170964362", name: "A" }], expiresAt: Date.now() - 1000, at: 1 })));
  const r = await adSpend("2026-11-18"); assert.equal(r.status.metaHouse.ok, false); assert.match(r.status.metaHouse.note, /expired/i);
});
test("the saved record never exposes the token in the page view", async () => {
  await connected(); const v = await meta.metaView();
  assert.equal(v.connected, true); assert.equal(v.accounts, 3); assert.ok(!JSON.stringify(v).includes("tok"));
});

test("page: Meta connection shows in Appearance and Profit, and reuses no element id", async () => {
  process.env.CONNECTOR_KEY = "k".repeat(20);
  const page = (await import("../api/orders-page.js")).default;
  const html = await new Promise((resolve) => { const res = { setHeader() {}, status() { return this; }, send: resolve, end: resolve }; page({ method: "GET", url: "/api/orders-page?key=" + "k".repeat(20), headers: {} }, res); });
  assert.ok((String(html).match(/class="[^"]*metaconn/g) || []).length >= 2);
  assert.equal((String(html).match(/id="prMeta"/g) || []).length, 1, "prMeta belongs to Delivery problems only");
  assert.ok(String(html).includes("data-meta=\"go\""));
});
