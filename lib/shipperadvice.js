// The "shipper advice" Google Sheet (shared as "anyone with the link can view"): one tab per month, one row per parcel
// (consignment number, a status word such as rts / both / ok, then name, address, phone) under date header rows.
// Parcels we marked "rts" there (the customer refused and we confirmed we won't send again) are RTS on the Return orders tab.
import { parseCsv } from "./daily.js";
import { kvEnabled } from "./kvstore.js";
import { rowsOfKind } from "./sheets.js";

const SHEET_ID = () => process.env.SHIPPER_ADVICE_SHEET_ID || "1omPGe89Y6elm9qnba1H4lb3kvGA-h5BuGYVYwLcbspc";
const TTL = 5 * 60 * 1000;
let cache = null;

const DATE_HEAD = /^\d{1,2}\s*[\s/.\-]\s*(\d{1,2}|[A-Za-z]{3,9})\s*[\s/.\-]\s*\d{2,4}$/;
const CN = /^\d{9,15}$/;
const RTS = /^\s*r\.?t\.?s\.?\s*$/i;

// Pure: rows of one tab -> Map(consignment number -> { day }) for every row marked rts.
export function parseAdvice(rows) {
  const out = new Map();
  let day = "";
  for (const cells of rows) {
    const nz = cells.map((c) => String(c ?? "").trim()).filter(Boolean);
    if (nz.length && nz.length <= 2 && DATE_HEAD.test(nz[0])) { day = nz[0]; if (!nz.slice(1).some((c) => CN.test(c))) continue; }
    const cn = cells.map((c) => String(c ?? "").replace(/[\s'"]/g, "")).find((c) => CN.test(c));
    if (!cn) continue;
    if (cells.some((c) => RTS.test(String(c ?? "")))) out.set(cn, { day });
  }
  return out;
}

async function getText(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
  try { const r = await fetch(url, { redirect: "follow", cache: "no-store", signal: ctl.signal }); return { ok: r.ok, status: r.status, text: await r.text() }; }
  finally { clearTimeout(t); }
}

async function tabIds() {
  if (process.env.SHIPPER_ADVICE_GIDS) return process.env.SHIPPER_ADVICE_GIDS.split(",").map((x) => x.trim()).filter(Boolean);
  const ids = new Set(["0"]);
  try {
    const r = await getText(`https://docs.google.com/spreadsheets/d/${SHEET_ID()}/htmlview`);
    for (const m of r.text.matchAll(/[?&#]gid=(\d{1,12})/g)) ids.add(m[1]);
  } catch { /* tab 0 is always tried */ }
  return [...ids].slice(0, 60);
}

// All tabs, read together. The sheet is small, so keep the answer for 5 minutes; Refresh reads it again.
export async function adviceRts({ refresh = false } = {}) {
  if (!refresh && cache && Date.now() - cache.at < TTL) return cache.data;
  // Once the shipper advice sheet has been copied into the Sheets tab (kind "advice"), that copy is the truth.
  if (kvEnabled()) {
    let own = null; try { own = await rowsOfKind("advice"); } catch { /* fall back to Google */ }
    if (own) {
      const map = new Map();
      for (const t of own.tabs) for (const [cn, v] of parseAdvice(t.rows)) if (!map.has(cn)) map.set(cn, { ...v, tab: t.name });
      const data = { map, tabs: own.tabs.length, errors: [], own: true };
      cache = { at: Date.now(), data }; return data;
    }
  }
  const gids = await tabIds();
  const parts = await Promise.all(gids.map(async (gid) => {
    try {
      const r = await getText(`https://docs.google.com/spreadsheets/d/${SHEET_ID()}/export?format=csv&gid=${gid}&_=${Date.now()}`);
      if (!r.ok || /^\s*<(!doctype|html)/i.test(r.text)) return { gid, error: "HTTP " + r.status + (/<html/i.test(r.text) ? " (the sheet is not shared as 'anyone with the link can view')" : "") };
      return { gid, map: parseAdvice(parseCsv(r.text)) };
    } catch (e) { return { gid, error: e.name === "AbortError" ? "timed out" : e.message }; }
  }));
  const ok = parts.filter((p) => p.map);
  if (!ok.length) throw new Error(parts.map((p) => p.error).filter(Boolean)[0] || "no tab could be read");
  const map = new Map();
  for (const p of ok) for (const [cn, v] of p.map) if (!map.has(cn)) map.set(cn, { ...v, tab: p.gid });
  const data = { map, tabs: ok.length, errors: parts.filter((p) => p.error).map((p) => p.gid + ": " + p.error) };
  cache = { at: Date.now(), data };
  return data;
}
