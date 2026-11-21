// Direct Meta (Facebook) ad connection through our own Merchixo Meta app, read-only (ads_read). It replaces the Windsor "facebook"
// connector, so that Windsor slot is free. The owner signs in with Facebook once; the long-lived token is kept encrypted in
// Upstash. Spend and campaign rows come back shaped like Windsor's, so lib/ads.js treats both the same.
// Nothing is ever created, edited or paused. Env: META_APP_SECRET (Merchixo app secret), optional META_APP_ID.
import { createHmac, createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { kvGet, kvSet, kvDel, kvEnabled } from "./kvstore.js";
import { publicBase } from "./auth.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const KEY = "cs:meta";
export const metaAppId = () => process.env.META_APP_ID || "1051893461235425";
export const metaEnabled = () => !!process.env.META_APP_SECRET && kvEnabled();
export const redirectUri = () => publicBase() + "/meta-callback";
const idOf = (s) => String(s || "").replace(/^act_/i, "").replace(/\D/g, "");

// ---- encryption of the saved token (AES-256-GCM, key derived from the app secret) ----
const aesKey = () => createHash("sha256").update("cs-meta:" + (process.env.META_APP_SECRET || "")).digest();
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

// ---- sign-in state: proves the callback belongs to a sign-in this server started (10 minutes) ----
const mac = (s) => createHmac("sha256", process.env.META_APP_SECRET || "x").update("state:" + s).digest("base64url");
export function makeState(now = Date.now()) { const p = randomBytes(8).toString("hex") + "." + Math.floor(now / 1000 + 600); return p + "." + mac(p); }
export function stateOk(state, now = Date.now()) {
  const [n, exp, sig] = String(state || "").split(".");
  if (!n || !exp || !sig) return false;
  const want = mac(n + "." + exp), a = Buffer.from(sig), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b) && Number(exp) * 1000 >= now;
}
export const authUrl = () => "https://www.facebook.com/v21.0/dialog/oauth?client_id=" + metaAppId() + "&redirect_uri=" + encodeURIComponent(redirectUri()) + "&state=" + encodeURIComponent(makeState()) + "&scope=ads_read";

async function graph(path, token, params = {}, fetcher = fetch) {
  const q = new URLSearchParams(params).toString();
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetcher(path.startsWith("http") ? path : GRAPH + path + (q ? "?" + q : ""), { signal: ac.signal, headers: token ? { Authorization: "Bearer " + token } : {} });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.error) {
      const e = j && j.error ? j.error : {};
      const err = new Error(e.code === 190 ? "Your Meta login expired. Press Reconnect Meta." : "Meta said: " + (e.message || r.status));
      err.expired = e.code === 190; throw err;
    }
    return j;
  } catch (e) { throw e.name === "AbortError" ? new Error("Meta took too long") : e; } finally { clearTimeout(t); }
}

// Called with the ?code= Facebook sends back. Saves the connection.
export async function connect(code) {
  const id = metaAppId(), secret = process.env.META_APP_SECRET;
  const short = await graph("/oauth/access_token", null, { client_id: id, client_secret: secret, redirect_uri: redirectUri(), code });
  const long = await graph("/oauth/access_token", null, { grant_type: "fb_exchange_token", client_id: id, client_secret: secret, fb_exchange_token: short.access_token }).catch(() => short);
  const token = long.access_token;
  const [me, accs] = await Promise.all([graph("/me", token, { fields: "id,name" }), graph("/me/adaccounts", token, { fields: "account_id,name,currency", limit: "200" })]);
  const accounts = (accs.data || []).map((a) => ({ id: idOf(a.account_id), name: String(a.name || ""), currency: String(a.currency || "") })).filter((a) => a.id);
  const rec = { token, fbUser: String(me.id), name: String(me.name || ""), accounts, expiresAt: Date.now() + (Number(long.expires_in) || 5184000) * 1000, at: Date.now() };
  await kvSet(KEY, seal(rec));
  return rec;
}
export async function getMeta() { const v = await kvGet(KEY); return v ? unseal(v) : null; }
export const removeMeta = () => kvDel(KEY);

// What the page shows: never the token.
export async function metaView() {
  const m = metaEnabled() ? await getMeta() : null;
  return { enabled: metaEnabled(), connected: !!m, name: m ? m.name : "", expired: !!m && m.expiresAt < Date.now(), accounts: m ? m.accounts.length : 0, redirect: redirectUri(), since: m ? m.at : null };
}

async function insights(token, id, params) {
  const out = []; let url = "/act_" + id + "/insights", p = { limit: "500", ...params };
  for (let i = 0; i < 20 && url; i++) {
    const j = await graph(url, token, p); out.push(...(j.data || []));
    url = j.paging && j.paging.next; p = {};
  }
  return out;
}
const act = (arr, type) => { const a = (arr || []).find((x) => x.action_type === type); return a ? Number(a.value) || 0 : 0; };
const range = (from, to) => JSON.stringify({ since: from, until: to });

// Which accessible ad accounts a caller wants: exact ids, plus any whose name matches nameRe (minus skips).
export function pickAccounts(accounts, { ids = [], nameRe = null, skipIds = [], skipNameRe = null } = {}) {
  return (accounts || []).filter((a) => {
    if (skipIds.includes(a.id)) return false;
    if (skipNameRe && skipNameRe.test(a.name || "")) return false;
    return ids.includes(a.id) || !!(nameRe && nameRe.test(a.name || ""));
  });
}

// Daily spend rows shaped like Windsor's: { account_id, account_name, date, spend }.
export async function metaSpendRows(meta, accounts, from, to) {
  if (meta.expiresAt < Date.now()) { const e = new Error("Your Meta login expired. Press Reconnect Meta."); e.expired = true; throw e; }
  const rows = [];
  await Promise.all(accounts.map(async (a) => {
    for (const r of await insights(meta.token, a.id, { fields: "spend", level: "account", time_increment: "1", time_range: range(from, to) }))
      rows.push({ account_id: a.id, account_name: a.name, date: r.date_start, spend: Number(r.spend) || 0 });
  }));
  return rows;
}
// Campaign rows shaped like Windsor's facebook rows.
export async function metaCampaignRows(meta, accounts, from, to) {
  if (meta.expiresAt < Date.now()) { const e = new Error("Your Meta login expired. Press Reconnect Meta."); e.expired = true; throw e; }
  const rows = [];
  await Promise.all(accounts.map(async (a) => {
    for (const r of await insights(meta.token, a.id, { fields: "campaign_id,campaign_name,spend,actions,action_values", level: "campaign", time_range: range(from, to) }))
      rows.push({ account_id: a.id, campaign_id: r.campaign_id, campaign: r.campaign_name, spend: Number(r.spend) || 0, actions_omni_purchase: act(r.actions, "omni_purchase"), action_values_omni_purchase: act(r.action_values, "omni_purchase") });
  }));
  return rows;
}
