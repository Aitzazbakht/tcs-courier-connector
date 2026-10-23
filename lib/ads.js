// Ad spend for one day, read from Windsor.ai (one API key, WINDSOR_API_KEY, covers Meta, TikTok and Google Ads).
// An account is only filled in when Windsor has rows for it in the last 7 days; otherwise it is left blank so
// the person types it in, because "no rows" can mean "not connected in Windsor" as well as "spent nothing".
const BASE = "https://connectors.windsor.ai/";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const norm = (s) => String(s || "").replace(/^act_/i, "").replace(/[-\s]/g, "");

// key -> where its spend comes from
const SOURCES = [
  { key: "metaHouse", connector: "facebook", ids: ["1331709170964362"] },
  { key: "metaHerbs", connector: "facebook", ids: ["1327473458069144"] },
  { key: "tiktokHouse", connector: "tiktok", ids: ["7574531151872737296"] },
  { key: "tiktokNew", connector: "tiktok", ids: ["7594410969577701392"] },
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

export async function adSpend(date) {
  if (!ISO.test(date || "")) throw new Error("Pick the order date first.");
  if (!process.env.WINDSOR_API_KEY) throw new Error("No Windsor key yet. Add WINDSOR_API_KEY in Vercel and redeploy.");
  const from = addDays(date, -6);
  const connectors = [...new Set(SOURCES.map((s) => s.connector))];
  const got = {};
  await Promise.all(connectors.map(async (c) => { try { got[c] = { rows: await pull(c, from, date) }; } catch (e) { got[c] = { error: e.message }; } }));

  const amounts = {}, status = {};
  for (const s of SOURCES) {
    const g = got[s.connector];
    if (g.error) { status[s.key] = { ok: false, note: g.error }; continue; }
    const mine = g.rows.filter((r) => {
      const id = norm(r.account_id);
      if (s.skipIds && s.skipIds.includes(id)) return false;
      if (s.skipNameRe && s.skipNameRe.test(r.account_name || "")) return false;
      return s.ids.includes(id) || (s.nameRe && s.nameRe.test(r.account_name || ""));
    });
    if (!mine.length) { status[s.key] = { ok: false, note: "Not in Windsor (not connected, or no spend in the last 7 days)" }; continue; }
    const day = mine.filter((r) => String(r.date).slice(0, 10) === date);
    const total = day.reduce((x, r) => x + (Number(r.spend) || 0), 0);
    amounts[s.key] = Math.round(total);
    const names = [...new Set(mine.map((r) => r.account_name).filter(Boolean))];
    status[s.key] = { ok: true, note: day.length ? "From Windsor" : "From Windsor (no spend that day)", accounts: s.key === "otherMeta" ? names : undefined };
  }
  return { date, amounts, status };
}
