// Tiny Upstash Redis (HTTPS REST) client. Used only by the Sheets tab, which keeps its data here
// (Shopify metafields are far too small for sheets). Env: KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*).
// Tests can swap in a fake with setKv().
let fake = null;
export const setKv = (f) => { fake = f; };
const URL_ = () => (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, "");
const TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const kvEnabled = () => !!fake || !!(URL_() && TOKEN());

async function cmd(args) {
  if (fake) return fake(args);
  if (!kvEnabled()) throw new Error("Sheets storage is not connected yet: add the Upstash database to this Vercel project (KV_REST_API_URL and KV_REST_API_TOKEN) and redeploy.");
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(URL_(), { method: "POST", headers: { Authorization: "Bearer " + TOKEN(), "Content-Type": "application/json" }, body: JSON.stringify(args), signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error("Storage error: " + (j.error || "HTTP " + r.status));
    return j.result;
  } finally { clearTimeout(t); }
}

export async function kvGet(key) { const v = await cmd(["GET", key]); if (v == null) return null; try { return JSON.parse(v); } catch { return null; } }
export const kvSet = (key, val) => cmd(["SET", key, JSON.stringify(val)]);
export const kvDel = (key) => cmd(["DEL", key]);
export const kvPush = (key, val, max = 1000) => cmd(["LPUSH", key, JSON.stringify(val)]).then(() => cmd(["LTRIM", key, "0", String(max - 1)]));
export async function kvRange(key, n = 200) { const a = await cmd(["LRANGE", key, "0", String(n - 1)]); return (a || []).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean); }

// Many keys at once: one round trip each way instead of one per key.
export async function kvMget(keys) {
  if (!keys.length) return [];
  const a = await cmd(["MGET", ...keys]);
  return (a || []).map((x) => { if (x == null) return null; try { return JSON.parse(x); } catch { return null; } });
}
export async function kvSetMany(entries, ttlSec) {
  if (!entries.length) return;
  if (fake) { for (const [k, v] of entries) await fake(["SET", k, JSON.stringify(v), "EX", String(ttlSec)]); return; }
  if (!kvEnabled()) return;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(URL_() + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + TOKEN(), "Content-Type": "application/json" }, body: JSON.stringify(entries.map(([k, v]) => ["SET", k, JSON.stringify(v), "EX", String(ttlSec)])), signal: ctl.signal });
    if (!r.ok) throw new Error("Storage error: HTTP " + r.status);
  } finally { clearTimeout(t); }
}
