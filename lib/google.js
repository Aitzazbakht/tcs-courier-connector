// Direct Google Ads connection through our own Google Cloud OAuth client, read-only (adwords scope). It replaces the Windsor
// "google_ads" connector. The owner signs in with Google once; the long-lived refresh token is kept encrypted in Upstash and
// a short access token is made from it for each read. Nothing is ever created, edited or paused.
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Optional: GOOGLE_ADS_LOGIN_CUSTOMER_ID (manager id, no hyphens),
// GOOGLE_ADS_DEVELOPER_TOKEN (sent only if set; access is cloud-managed now, so normally not needed).
import { createHmac, createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { kvGet, kvSet, kvDel, kvEnabled } from "./kvstore.js";
import { publicBase } from "./auth.js";

const KEY = "cs:google";
const API = "https://googleads.googleapis.com/v26";
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) && kvEnabled();
export const redirectUri = () => publicBase() + "/google-callback";
const digits = (s) => String(s || "").replace(/\D/g, "");

const aesKey = () => createHash("sha256").update("cs-google:" + (process.env.GOOGLE_CLIENT_SECRET || "")).digest();
export function seal(obj) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return "v1." + [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
export function unseal(s) {
  const [v, iv, tag, enc] = String(s || "").split(".");
  if (v !== "v1" || !enc) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(iv, "base64url")); d.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8"));
  } catch { return null; }
}

const mac = (s) => createHmac("sha256", process.env.GOOGLE_CLIENT_SECRET || "x").update("gstate:" + s).digest("base64url");
export function makeState(now = Date.now()) { const p = randomBytes(8).toString("hex") + "." + Math.floor(now / 1000 + 600); return p + "." + mac(p); }
export function stateOk(state, now = Date.now()) {
  const [n, exp, sig] = String(state || "").split(".");
  if (!n || !exp || !sig) return false;
  const a = Buffer.from(sig), b = Buffer.from(mac(n + "." + exp));
  return a.length === b.length && timingSafeEqual(a, b) && Number(exp) * 1000 >= now;
}
export const authUrl = () => "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: process.env.GOOGLE_CLIENT_ID || "", redirect_uri: redirectUri(), response_type: "code",
  scope: "https://www.googleapis.com/auth/adwords openid email", access_type: "offline", prompt: "consent", state: makeState(),
}).toString();

async function timed(url, init, fetcher = fetch) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 25000);
  try { return await fetcher(url, { ...init, signal: ac.signal }); }
  catch (e) { throw e.name === "AbortError" ? new Error("Google took too long") : e; }
  finally { clearTimeout(t); }
}
async function tokenCall(params) {
  const r = await timed("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", ...params }).toString() });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.error) {
    const err = new Error(j && j.error === "invalid_grant" ? "Your Google login expired or was removed. Press Reconnect Google." : "Google said: " + ((j && (j.error_description || j.error)) || r.status));
    err.expired = !!(j && j.error === "invalid_grant"); throw err;
  }
  return j;
}
const cache = new Map(); // refresh token hash -> { token, until }
export async function accessToken(rec) {
  const k = createHash("sha256").update(rec.refresh).digest("hex").slice(0, 16), c = cache.get(k);
  if (c && c.until > Date.now() + 60000) return c.token;
  const j = await tokenCall({ grant_type: "refresh_token", refresh_token: rec.refresh });
  cache.set(k, { token: j.access_token, until: Date.now() + (Number(j.expires_in) || 3600) * 1000 });
  return j.access_token;
}
const adsHeaders = (token, login) => ({ "Content-Type": "application/json", Authorization: "Bearer " + token, ...(login ? { "login-customer-id": digits(login) } : {}), ...(process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? { "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN } : {}) });
async function adsCall(url, token, login, body) {
  const r = await timed(url, { method: body ? "POST" : "GET", headers: adsHeaders(token, login), body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.error) { const e = j && j.error ? j.error : {}; const err = new Error("Google Ads said: " + (e.message || r.status)); err.status = r.status; throw err; }
  return j;
}

export async function accessibleCustomers(token) {
  const j = await adsCall(API + "/customers:listAccessibleCustomers", token, null, null);
  return (j.resourceNames || []).map((n) => digits(n));
}
// Called with the ?code= Google sends back. Saves the connection.
export async function connect(code) {
  const j = await tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
  if (!j.refresh_token) throw new Error("Google did not give a lasting login. Press Connect Google again and approve everything.");
  let email = ""; try { email = JSON.parse(Buffer.from(String(j.id_token || "").split(".")[1] || "", "base64url").toString("utf8")).email || ""; } catch { /* name is optional */ }
  const customers = await accessibleCustomers(j.access_token).catch(() => []);
  const rec = { refresh: j.refresh_token, email, customers, at: Date.now() };
  await kvSet(KEY, seal(rec));
  return rec;
}
export async function getGoogle() { const v = await kvGet(KEY); return v ? unseal(v) : null; }
export const removeGoogle = () => kvDel(KEY);
export async function googleView() {
  const g = googleEnabled() ? await getGoogle() : null;
  return { enabled: googleEnabled(), connected: !!g, email: g ? g.email : "", customers: g ? g.customers.length : 0, redirect: redirectUri(), since: g ? g.at : null };
}

// Run one GAQL query on a customer. Reaching a client account through a manager needs login-customer-id: use the configured manager,
// else try the accounts the user can open directly until one works.
const loginWon = new Map();
export async function gaql(rec, customerId, query) {
  const token = await accessToken(rec), id = digits(customerId);
  const order = [];
  const add = (x) => { const v = x == null ? "" : digits(x); if (!order.includes(v)) order.push(v); };
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) add(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (loginWon.get(id)) add(loginWon.get(id));
  if (rec.customers.includes(id)) add("");
  for (const c of rec.customers) if (c !== id) add(c);
  add("");
  let last = null;
  for (const login of order) {
    try {
      const out = []; let pageToken = "";
      for (let i = 0; i < 30; i++) {
        const j = await adsCall(API + "/customers/" + id + "/googleAds:search", token, login, { query, ...(pageToken ? { pageToken } : {}) });
        out.push(...(j.results || [])); pageToken = j.nextPageToken || ""; if (!pageToken) break;
      }
      if (login) loginWon.set(id, login);
      return out;
    } catch (e) { last = e; if (!(e.status === 403 || e.status === 401 || e.status === 400)) throw e; }
  }
  throw last || new Error("Google Ads said no.");
}

const num = (v) => Number(v) || 0;
// Windsor-shaped rows. Costs are in micros (millionths of the account currency).
export async function googleSpendRows(rec, ids, from, to) {
  const rows = [];
  await Promise.all(ids.map(async (id) => {
    for (const r of await gaql(rec, id, "SELECT segments.date, customer.id, customer.descriptive_name, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '" + from + "' AND '" + to + "'"))
      rows.push({ account_id: id, account_name: (r.customer && r.customer.descriptiveName) || "", date: r.segments && r.segments.date, spend: num(r.metrics && r.metrics.costMicros) / 1e6 });
  }));
  return rows;
}
export async function googleCampaignRows(rec, ids, from, to) {
  const rows = [];
  await Promise.all(ids.map(async (id) => {
    for (const r of await gaql(rec, id, "SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '" + from + "' AND '" + to + "' AND metrics.cost_micros > 0"))
      rows.push({ account_id: id, campaign_id: String(r.campaign && r.campaign.id || ""), campaign: (r.campaign && r.campaign.name) || "", spend: num(r.metrics && r.metrics.costMicros) / 1e6, conversions: num(r.metrics && r.metrics.conversions), conversion_value: num(r.metrics && r.metrics.conversionsValue) });
  }));
  return rows;
}
