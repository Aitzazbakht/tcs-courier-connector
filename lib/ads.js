// Ad spend for one day, read from Windsor.ai (one API key, WINDSOR_API_KEY, covers Meta, TikTok and Google Ads).
// Meta is read straight from Meta through our own Merchixo app when it is connected (lib/meta.js), which frees the Windsor
// "facebook" slot; if that fails, or is not connected, Windsor's Meta connector is used as before.
// An account is only filled in when Windsor has rows for it in the last 7 days; otherwise it is left blank so
// the person types it in, because "no rows" can mean "not connected in Windsor" as well as "spent nothing".
import { getMeta, metaEnabled, pickAccounts, metaSpendRows, metaCampaignRows } from "./meta.js";
const BASE = "https://connectors.windsor.ai/";
const haveWindsor = () => !!process.env.WINDSOR_API_KEY;
const adsAvailable = async () => haveWindsor() || (metaEnabled() && !!(await getMeta().catch(() => null)));
export { adsAvailable };
// Meta rows for the Meta sources, from the direct connection when there is one; null when it is not connected (use Windsor).
async function directMetaRows(sources, from, to, campaigns) {
  if (!metaEnabled()) return null;
  const m = await getMeta().catch(() => null); if (!m) return null;
  const want = new Map();
  for (const s of sources) for (const a of pickAccounts(m.accounts, s)) want.set(a.id, a);
  const list = [...want.values()];
  return { source: "Meta", rows: await (campaigns ? metaCampaignRows : metaSpendRows)(m, list, from, to) };
}
async function pullMeta(sources, fields, from, to, campaigns) {
  try { const d = await directMetaRows(sources, from, to, campaigns); if (d) return { rows: d.rows, via: "Meta" }; }
  catch (e) { if (!haveWindsor()) return { error: e.message }; /* otherwise fall back to Windsor below */ }
  if (!haveWindsor()) return { error: "Meta is not connected and there is no Windsor key." };
  return { rows: fields ? await pullFields("facebook", fields, from, to) : await pull("facebook", from, to), via: "Windsor" };
}
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const norm = (s) => String(s || "").replace(/^act_/i, "").replace(/[-\s]/g, "");

// key -> where its spend comes from
const SOURCES = [
  { key: "metaHouse", connector: "facebook", ids: ["1331709170964362"] },
  { key: "metaHerbs", connector: "facebook", ids: ["1327473458069144"] },
  { key: "tiktokHouse", connector: "tiktok", ids: ["7574531151872737296"] },
  { key: "google", connector: "google_ads", ids: ["7903851046"] },
  // The other Chitral Meta accounts: two known ids, plus anything named Chitral / Markhor (never Gummiotics).
  { key: "otherMeta", connector: "facebook", ids: ["367256745877377", "267160568684946"], nameRe: /chitral|markhor/i, skipIds: ["1331709170964362", "1327473458069144"], skipNameRe: /gummiotics/i },
];

const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

async function pull(connector, from, to) {
  const key = process.env.WINDSOR_API_KEY;
  const url = BASE + connector + "?api_key=" + encodeURIComponent(key) + "&fields=account_id,account_name,date,spend&date_from=" + from + "&date_to=" + to + "&_renderer=json";
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(url, { signal: ac.signal });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch (e) {}
    if (!r.ok) throw new Error("Windsor said " + r.status + (j && (j.message || j.error) ? ": " + (j.message || j.error) : ""));
    if (!j || !Array.isArray(j.data)) throw new Error((j && (j.message || j.error)) || "Windsor sent no data");
    return j.data;
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "Windsor took too long" : e.message);
  } finally { clearTimeout(t); }
}

export async function adSpend(date, to = "") {
  if (!ISO.test(date || "")) throw new Error("Pick the order date first.");
  if (!(await adsAvailable())) throw new Error("No ad source yet: press Connect Meta Ads, or add WINDSOR_API_KEY in Vercel and redeploy.");
  to = ISO.test(to || "") ? to : date;
  if (to < date) throw new Error("The end date is before the start date.");
  const from = addDays(date, -6);
  const connectors = [...new Set(SOURCES.map((s) => s.connector))];
  const got = {};
  await Promise.all(connectors.map(async (c) => {
    try {
      if (c === "facebook") got[c] = await pullMeta(SOURCES.filter((x) => x.connector === "facebook"), null, from, to, false);
      else if (!haveWindsor()) got[c] = { error: "No Windsor key" };
      else got[c] = { rows: await pull(c, from, to), via: "Windsor" };
    } catch (e) { got[c] = { error: e.message }; }
  }));

  const amounts = {}, status = {}, daily = {};
  for (const s of SOURCES) {
    const g = got[s.connector];
    if (g.error) { status[s.key] = { ok: false, note: g.error }; continue; }
    const mine = g.rows.filter((r) => {
      const id = norm(r.account_id);
      if (s.skipIds && s.skipIds.includes(id)) return false;
      if (s.skipNameRe && s.skipNameRe.test(r.account_name || "")) return false;
      return s.ids.includes(id) || (s.nameRe && s.nameRe.test(r.account_name || ""));
    });
    if (!mine.length) { status[s.key] = { ok: false, note: g.via === "Meta" ? "Not found in your Meta ad accounts (or no spend in the last 7 days)" : "Not in Windsor (not connected, or no spend in the last 7 days)" }; continue; }
    const day = mine.filter((r) => { const d = String(r.date).slice(0, 10); return d >= date && d <= to; });
    const total = day.reduce((x, r) => x + (Number(r.spend) || 0), 0);
    for (const r of day) { const d = String(r.date).slice(0, 10); daily[d] = (daily[d] || 0) + (Number(r.spend) || 0); }
    amounts[s.key] = Math.round(total);
    const names = [...new Set(mine.map((r) => r.account_name).filter(Boolean))];
    status[s.key] = { ok: true, note: (day.length ? "From " : "From ") + (g.via || "Windsor") + (day.length ? "" : " (no spend in that period)"), accounts: s.key === "otherMeta" ? names : undefined };
  }
  for (const d of Object.keys(daily)) daily[d] = Math.round(daily[d]);
  return { date, to, amounts, status, daily };
}

// Campaign-level numbers for one day, for the Sales report tab (spend, purchases and purchase value as the ad platform reports them).
// Only campaigns that spent something are returned. Meta is split into the two Chitral accounts by account id.
const CAMP = [
  { platform: "Meta – Chitral House", key: "metaHouse", connector: "facebook", ids: ["1331709170964362"], fields: "account_id,campaign_id,campaign,spend,actions_omni_purchase,action_values_omni_purchase", p: "actions_omni_purchase", v: "action_values_omni_purchase" },
  { platform: "Meta – Chitral Herbs", key: "metaHerbs", connector: "facebook", ids: ["1327473458069144"], fields: "account_id,campaign_id,campaign,spend,actions_omni_purchase,action_values_omni_purchase", p: "actions_omni_purchase", v: "action_values_omni_purchase" },
  { platform: "TikTok", key: "tiktok", connector: "tiktok", ids: ["7574531151872737296", "7594410969577701392"], fields: "account_id,campaign_id,campaign,spend,complete_payment,total_complete_payment_rate", p: "complete_payment", v: "total_complete_payment_rate" },
  { platform: "Google Ads", key: "google", connector: "google_ads", ids: ["7903851046"], fields: "account_id,campaign_id,campaign,spend,conversions,conversion_value", p: "conversions", v: "conversion_value" },
];
async function pullFields(connector, fields, date, to = date) {
  const url = BASE + connector + "?api_key=" + encodeURIComponent(process.env.WINDSOR_API_KEY) + "&fields=" + fields + "&date_from=" + date + "&date_to=" + to + "&_renderer=json";
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(url, { signal: ac.signal });
    const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (e) {}
    if (!r.ok || !j || !Array.isArray(j.data)) throw new Error("Windsor said " + r.status + (j && (j.message || j.error) ? ": " + (j.message || j.error) : ""));
    return j.data;
  } catch (e) { throw new Error(e.name === "AbortError" ? "Windsor took too long" : e.message); } finally { clearTimeout(t); }
}
export async function adCampaigns(date, to = date) {
  if (!ISO.test(date || "")) throw new Error("Pick a valid date.");
  if (!(await adsAvailable())) throw new Error("No ad source yet: press Connect Meta Ads, or add WINDSOR_API_KEY in Vercel and redeploy.");
  const connectors = [...new Set(CAMP.map((c) => c.connector))];
  const got = {};
  await Promise.all(connectors.map(async (c) => {
    try {
      const f = CAMP.find((x) => x.connector === c).fields;
      if (c === "facebook") got[c] = await pullMeta(CAMP.filter((x) => x.connector === "facebook"), f, date, to, true);
      else if (!haveWindsor()) got[c] = { error: "No Windsor key" };
      else got[c] = { rows: await pullFields(c, f, date, to) };
    } catch (e) { got[c] = { error: e.message }; }
  }));
  const rows = [], status = {};
  for (const c of CAMP) {
    const g = got[c.connector];
    if (g.error) { status[c.key] = { ok: false, note: g.error }; continue; }
    status[c.key] = { ok: true, note: "" };
    const agg = new Map();
    for (const r of g.rows) {
      if (!c.ids.includes(norm(r.account_id))) continue;
      const id = String(r.campaign_id || r.campaign || "");
      const a = agg.get(id) || { key: c.key, platform: c.platform, id, campaign: String(r.campaign || r.campaign_name || ""), spend: 0, purchases: 0, value: 0 };
      a.spend += Number(r.spend) || 0; a.purchases += Number(r[c.p]) || 0; a.value += Number(r[c.v]) || 0;
      agg.set(id, a);
    }
    for (const a of agg.values()) {
      if (a.spend <= 0) continue;
      rows.push({ ...a, spend: Math.round(a.spend), purchases: +a.purchases.toFixed(2), value: Math.round(a.value), roas: +(a.value / a.spend).toFixed(2) });
    }
  }
  rows.sort((a, b) => CAMP.findIndex((x) => x.key === a.key) - CAMP.findIndex((x) => x.key === b.key) || b.spend - a.spend);
  return { date, to, rows, status };
}
