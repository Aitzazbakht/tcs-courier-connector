import test from "node:test";
import assert from "node:assert/strict";
process.env.GOOGLE_CLIENT_ID = "cid.apps.googleusercontent.com"; process.env.GOOGLE_CLIENT_SECRET = "gsecret-not-real";
delete process.env.WINDSOR_API_KEY; delete process.env.META_APP_SECRET; delete process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
const { setKv } = await import("../lib/kvstore.js");
const g = await import("../lib/google.js");
const { adSpend, adCampaigns } = await import("../lib/ads.js");
const store = new Map();
setKv(async (a) => { const [c, k, v] = a; if (c === "GET") return store.has(k) ? store.get(k) : null; if (c === "SET") { store.set(k, v); return "OK"; } if (c === "DEL") { store.delete(k); return 1; } return null; });

test("saved Google login is encrypted and only our secret opens it", () => {
  const s = g.seal({ refresh: "1//refresh-secret" }); assert.ok(!s.includes("refresh-secret"));
  assert.deepEqual(g.unseal(s), { refresh: "1//refresh-secret" });
  process.env.GOOGLE_CLIENT_SECRET = "other"; assert.equal(g.unseal(s), null); process.env.GOOGLE_CLIENT_SECRET = "gsecret-not-real";
});
test("sign-in link asks for read-only Google Ads access, offline, with a checked state", () => {
  const u = new URL(g.authUrl()); assert.equal(u.hostname, "accounts.google.com");
  assert.match(u.searchParams.get("scope"), /auth\/adwords/); assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("redirect_uri"), "https://tcs-courier-connector.vercel.app/google-callback");
  assert.ok(g.stateOk(u.searchParams.get("state"))); assert.ok(!g.stateOk("a.b.c")); assert.ok(!g.stateOk(u.searchParams.get("state"), Date.now() + 11 * 60000));
});

const realFetch = globalThis.fetch; const calls = [];
const json = (o, ok = true, status = 200) => ({ ok, status, json: async () => o });
function fakeGoogle() {
  calls.length = 0;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url); calls.push({ u, h: init.headers || {}, b: init.body });
    if (u.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "acc", expires_in: 3600 });
    if (/googleAds:search/.test(u) && /campaign/.test(String(init.body))) return json({ results: [{ campaign: { id: "55", name: "Search gummies" }, metrics: { costMicros: "2500000", conversions: 4, conversionsValue: 9000 } }] });
    if (/googleAds:search/.test(u)) return json({ results: [{ segments: { date: "2026-11-18" }, customer: { descriptiveName: "Chitral" }, metrics: { costMicros: "1200500000" } }, { segments: { date: "2026-11-19" }, customer: {}, metrics: { costMicros: "300000000" } }] });
    throw new Error("unexpected " + u);
  };
}
const connected = (customers = ["7903851046"]) => store.set("cs:google", JSON.stringify(g.seal({ refresh: "r1", email: "me@x.com", customers, at: 1 })));

test("Google spend comes from Google directly, in rupees from micros", async () => {
  connected(); fakeGoogle();
  try {
    const r = await adSpend("2026-11-18", "2026-11-19");
    assert.equal(r.amounts.google, 1501); assert.match(r.status.google.note, /Google/);
    const call = calls.find((c) => /googleAds:search/.test(c.u));
    assert.match(call.u, /\/customers\/7903851046\//); assert.equal(call.h.Authorization, "Bearer acc"); assert.ok(!("login-customer-id" in call.h), "directly open account needs no login id");
    assert.ok(!("developer-token" in call.h));
  } finally { globalThis.fetch = realFetch; }
});
test("a client account reached through a manager sends the manager as login-customer-id", async () => {
  connected(["1112223334"]); fakeGoogle();
  try {
    await adSpend("2026-11-18");
    const call = calls.find((c) => /googleAds:search/.test(c.u)); assert.equal(call.h["login-customer-id"], "1112223334");
  } finally { globalThis.fetch = realFetch; }
});
test("campaigns carry purchases and value", async () => {
  connected(); fakeGoogle();
  try {
    const r = await adCampaigns("2026-11-18"); const row = r.rows.find((x) => x.key === "google");
    assert.equal(row.campaign, "Search gummies"); assert.equal(row.spend, 3); assert.equal(row.purchases, 4); assert.equal(row.value, 9000);
  } finally { globalThis.fetch = realFetch; }
});
test("not connected: a clear message; page view never shows the token", async () => {
  store.clear(); await assert.rejects(adSpend("2026-11-18"), /Connect/);
  connected(); const v = await g.googleView(); assert.equal(v.connected, true); assert.ok(!JSON.stringify(v).includes("r1"));
});
test("page shows the Google connection in Appearance and Profit", async () => {
  process.env.CONNECTOR_KEY = "k".repeat(20);
  const page = (await import("../api/orders-page.js")).default;
  const html = await new Promise((resolve) => { const res = { setHeader() {}, status() { return this; }, send: resolve, end: resolve }; page({ method: "GET", url: "/api/orders-page?key=" + "k".repeat(20), headers: {} }, res); });
  assert.ok((String(html).match(/class="[^"]*googleconn/g) || []).length >= 2); assert.ok(String(html).includes('data-google="go"'));
});
