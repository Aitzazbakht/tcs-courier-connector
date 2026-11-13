// The Sheets tab: simple Google-style sheets kept in Upstash (key prefix cs:). Cell edits only, rows add/delete, tabs,
// and a last-edit history per sheet that can be reverted. Import copies a Google Sheet (shared "anyone with the link") once.
import { kvGet, kvSet, kvDel, kvPush, kvRange } from "./kvstore.js";
import { parseCsv } from "./daily.js";

const META = "cs:sheets", tabKey = (id) => "cs:tab:" + id, histKey = (id) => "cs:hist:" + id;
const MAX_ROWS = 20000, MAX_COLS = 40, MAX_CELL = 2000;
const rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clean = (v) => String(v ?? "").slice(0, MAX_CELL);
const who = (u) => String(u || "Someone").slice(0, 40);

const loadMeta = async () => (await kvGet(META)) || { sheets: [] };
const findSheet = (m, id) => { const s = m.sheets.find((x) => x.id === id); if (!s) throw new Error("That sheet no longer exists."); return s; };
const findTab = (s, id) => { const t = s.tabs.find((x) => x.id === id); if (!t) throw new Error("That tab no longer exists."); return t; };
const touch = (o, user) => { o.editedAt = new Date().toISOString(); o.editedBy = who(user); };

export async function sheetsList() {
  const m = await loadMeta();
  return { sheets: m.sheets };
}

export async function createSheet(name, user, kind = "") {
  const m = await loadMeta();
  const s = { id: rid(), name: clean(name).trim() || "New sheet", kind, tabs: [] };
  const t = { id: rid(), name: "Sheet 1" };
  s.tabs.push(t); touch(s, user); touch(t, user);
  await kvSet(tabKey(t.id), { rows: [["", "", "", ""]] });
  m.sheets.push(s); await kvSet(META, m);
  return s;
}

export async function renameSheet(id, name, user) { const m = await loadMeta(); const s = findSheet(m, id); s.name = clean(name).trim() || s.name; touch(s, user); await kvSet(META, m); return s; }
export async function renameTab(sid, tid, name, user) { const m = await loadMeta(); const s = findSheet(m, sid), t = findTab(s, tid); t.name = clean(name).trim() || t.name; touch(t, user); touch(s, user); await kvSet(META, m); return s; }
export async function addTab(sid, name, user) {
  const m = await loadMeta(); const s = findSheet(m, sid);
  const t = { id: rid(), name: clean(name).trim() || "Tab " + (s.tabs.length + 1) }; touch(t, user); touch(s, user);
  s.tabs.push(t); await kvSet(tabKey(t.id), { rows: [["", "", "", ""]] }); await kvSet(META, m);
  await logHist(sid, { u: who(user), tab: t.id, tn: t.name, k: "tab", d: "added tab" });
  return s;
}
export async function deleteTab(sid, tid, user) {
  const m = await loadMeta(); const s = findSheet(m, sid); const t = findTab(s, tid);
  if (s.tabs.length < 2) throw new Error("A sheet needs at least one tab.");
  s.tabs = s.tabs.filter((x) => x.id !== tid); touch(s, user); await kvSet(META, m);
  await logHist(sid, { u: who(user), tab: tid, tn: t.name, k: "tab", d: "deleted tab" });
  await kvDel(tabKey(tid));
  return s;
}
export async function deleteSheet(sid) {
  const m = await loadMeta(); const s = findSheet(m, sid);
  m.sheets = m.sheets.filter((x) => x.id !== sid); await kvSet(META, m);
  for (const t of s.tabs) await kvDel(tabKey(t.id)); await kvDel(histKey(sid));
}

export async function getTab(sid, tid) {
  const m = await loadMeta(); const s = findSheet(m, sid); const t = findTab(s, tid);
  const d = (await kvGet(tabKey(tid))) || { rows: [] };
  return { tab: t, rows: d.rows };
}

async function logHist(sid, e) { await kvPush(histKey(sid), { at: new Date().toISOString(), ...e }, 1000); }

const width = (rows) => rows.reduce((w, r) => Math.max(w, r.length), 0);
function grow(rows, r, c) {
  if (r >= MAX_ROWS || c >= MAX_COLS) throw new Error("That is past the end of the sheet limit (" + MAX_ROWS + " rows, " + MAX_COLS + " columns).");
  while (rows.length <= r) rows.push([]);
  while (rows[r].length <= c) rows[r].push("");
}

// edits: [{r,c,v}] applied to the newest saved copy, so two people editing different cells never overwrite each other.
export async function editCells(sid, tid, edits, user) {
  if (!Array.isArray(edits) || !edits.length) return { changed: 0 };
  if (edits.length > 5000) throw new Error("Too many cells at once (limit 5000).");
  const m = await loadMeta(); const s = findSheet(m, sid); const t = findTab(s, tid);
  const d = (await kvGet(tabKey(tid))) || { rows: [] };
  const hist = []; const u = who(user);
  for (const e of edits) {
    const r = Number(e.r), c = Number(e.c); if (!(r >= 0) || !(c >= 0) || !Number.isInteger(r) || !Number.isInteger(c)) continue;
    const v = clean(e.v);
    const old = d.rows[r]?.[c] ?? "";
    if (old === v) continue;
    grow(d.rows, r, c); d.rows[r][c] = v;
    hist.push({ u, tab: tid, tn: t.name, k: "cell", r, c, o: String(old).slice(0, 300), n: v.slice(0, 300) });
  }
  if (!hist.length) return { changed: 0 };
  const w = width(d.rows); d.rows.forEach((row) => { while (row.length < w) row.push(""); });
  await kvSet(tabKey(tid), d);
  touch(t, user); touch(s, user); await kvSet(META, m);
  // One history line per save, listing up to 8 cells, so a big paste is one entry and not hundreds.
  const first = hist[0];
  await logHist(sid, hist.length === 1 ? first : { u, tab: tid, tn: t.name, k: "paste", n: hist.length, cells: hist.slice(0, 200).map((h) => ({ r: h.r, c: h.c, o: h.o, n: h.n })) });
  return { changed: hist.length, editedAt: t.editedAt, editedBy: t.editedBy };
}

export async function insertRows(sid, tid, at, count, user) {
  const m = await loadMeta(); const s = findSheet(m, sid); const t = findTab(s, tid);
  const d = (await kvGet(tabKey(tid))) || { rows: [] };
  count = Math.max(1, Math.min(500, Number(count) || 1)); at = Math.max(0, Math.min(d.rows.length, Number(at) || 0));
  if (d.rows.length + count > MAX_ROWS) throw new Error("Sheet is full.");
  const w = Math.max(width(d.rows), 4);
  d.rows.splice(at, 0, ...Array.from({ length: count }, () => Array(w).fill("")));
  await kvSet(tabKey(tid), d); touch(t, user); touch(s, user); await kvSet(META, m);
  await logHist(sid, { u: who(user), tab: tid, tn: t.name, k: "rows", d: "added " + count + " row" + (count > 1 ? "s" : "") + " at row " + (at + 1) });
  return { rows: d.rows.length };
}
// Deleted rows are kept in the history entry so they can be restored.
export async function deleteRows(sid, tid, at, count, user) {
  const m = await loadMeta(); const s = findSheet(m, sid); const t = findTab(s, tid);
  const d = (await kvGet(tabKey(tid))) || { rows: [] };
  count = Math.max(1, Math.min(500, Number(count) || 1)); at = Math.max(0, Number(at) || 0);
  const gone = d.rows.splice(at, count); if (!gone.length) return { rows: d.rows.length };
  if (!d.rows.length) d.rows.push(Array(Math.max(4, width(gone))).fill(""));
  await kvSet(tabKey(tid), d); touch(t, user); touch(s, user); await kvSet(META, m);
  await logHist(sid, { u: who(user), tab: tid, tn: t.name, k: "delrows", r: at, rows: gone, d: "deleted " + gone.length + " row" + (gone.length > 1 ? "s" : "") + " at row " + (at + 1) });
  return { rows: d.rows.length };
}

export async function history(sid, n = 200) { const m = await loadMeta(); findSheet(m, sid); return { entries: await kvRange(histKey(sid), n) }; }

// Revert one history entry: puts back the old cell value(s) or the deleted rows. Logged as a new edit.
export async function revert(sid, at, user) {
  const list = await kvRange(histKey(sid), 1000);
  const e = list.find((x) => x.at === at); if (!e) throw new Error("That history entry is too old to revert.");
  const m = await loadMeta(); const s = findSheet(m, sid); findTab(s, e.tab);
  if (e.k === "cell") return editCells(sid, e.tab, [{ r: e.r, c: e.c, v: e.o }], user);
  if (e.k === "paste") return editCells(sid, e.tab, e.cells.map((x) => ({ r: x.r, c: x.c, v: x.o })), user);
  if (e.k === "delrows") {
    const d = (await kvGet(tabKey(e.tab))) || { rows: [] };
    d.rows.splice(Math.min(e.r, d.rows.length), 0, ...e.rows); await kvSet(tabKey(e.tab), d);
    const t = findTab(s, e.tab); touch(t, user); touch(s, user); await kvSet(META, m);
    await logHist(sid, { u: who(user), tab: e.tab, tn: t.name, k: "rows", d: "restored " + e.rows.length + " deleted row(s)" });
    return { changed: e.rows.length };
  }
  throw new Error("That kind of change cannot be reverted.");
}

// ---- Import from Google Sheets (once) ----
const gid = (url) => { const m = String(url).match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/); return m ? m[1] : /^[A-Za-z0-9_-]{20,}$/.test(String(url).trim()) ? String(url).trim() : ""; };
async function getText(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
  try { const r = await fetch(url, { redirect: "follow", cache: "no-store", signal: ctl.signal }); return { ok: r.ok, status: r.status, text: await r.text() }; }
  finally { clearTimeout(t); }
}
export const googleTabs = (html) => {
  const out = new Map();
  for (const m of html.matchAll(/items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(\d{1,12})"/g)) { let n = m[1]; try { n = JSON.parse('"' + n + '"'); } catch { /* keep raw */ } out.set(m[2], n.trim()); }
  for (const m of html.matchAll(/[?&#]gid=(\d{1,12})/g)) if (!out.has(m[1])) out.set(m[1], "");
  return [...out].slice(0, 60);
};
// Names the tabs of an imported sheet again from Google (for sheets imported before the real names were read).
export async function relabelFromGoogle(sid, user) {
  const m = await loadMeta(); const s = findSheet(m, sid); if (!s.source) throw new Error("This sheet was not imported from Google.");
  const head = await getText(`https://docs.google.com/spreadsheets/d/${s.source}/htmlview`);
  if (!head.ok) throw new Error("Could not open the Google sheet (HTTP " + head.status + ").");
  const names = new Map(googleTabs(head.text)); let n = 0;
  for (const t of s.tabs) { const nm = names.get(t.gid); if (nm && nm !== t.name) { t.name = nm; n++; } }
  touch(s, user); await kvSet(META, m); return { sheet: s, renamed: n };
}
// Google gives no tab names without the API unless the htmlview menu has them; unnamed tabs are called "Tab n".
export async function importGoogle(url, name, user, kind = "") {
  const id = gid(url); if (!id) throw new Error("That is not a Google Sheets link.");
  const head = await getText(`https://docs.google.com/spreadsheets/d/${id}/htmlview`);
  if (!head.ok) throw new Error(head.status === 401 || head.status === 403 ? "Google says this sheet is private. Open it, press Share, set General access to 'Anyone with the link' (Viewer), then import again." : "Could not open the sheet (HTTP " + head.status + ").");
  const title = (head.text.match(/<title>([^<]*)<\/title>/i)?.[1] || "").replace(/\s*-\s*Google Sheets\s*$/i, "").trim();
  const tabs = googleTabs(head.text); if (!tabs.some((t) => t[0] === "0")) tabs.unshift(["0", ""]);
  const got = [];
  for (const [g, nm] of tabs) {
    const r = await getText(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${g}`);
    if (!r.ok || /^\s*<(!doctype|html)/i.test(r.text)) continue;
    const rows = parseCsv(r.text).slice(0, MAX_ROWS).map((x) => x.slice(0, MAX_COLS).map(clean));
    while (rows.length && rows[rows.length - 1].every((c) => !c)) rows.pop();
    if (!rows.length) rows.push(["", "", "", ""]);
    const w = width(rows); rows.forEach((x) => { while (x.length < w) x.push(""); });
    got.push({ g, nm, rows });
  }
  if (!got.length) throw new Error("No tab could be read from that sheet.");
  const m = await loadMeta();
  const s = { id: rid(), name: clean(name).trim() || title || "Imported sheet", kind, tabs: [], source: id }; touch(s, user);
  got.forEach((x, i) => { s.tabs.push({ id: rid(), name: x.nm || (got.length === 1 ? "Sheet 1" : "Tab " + (i + 1)), editedAt: s.editedAt, editedBy: s.editedBy, gid: x.g }); });
  for (let i = 0; i < got.length; i++) await kvSet(tabKey(s.tabs[i].id), { rows: got[i].rows });
  m.sheets.push(s); await kvSet(META, m);
  await logHist(s.id, { u: who(user), tab: s.tabs[0].id, tn: s.tabs[0].name, k: "tab", d: "imported " + got.length + " tab(s), " + got.reduce((n, x) => n + x.rows.length, 0) + " rows from Google Sheets" });
  return s;
}

// Rows of every tab of the sheet with the given kind ("courier" / "advice"), for the reports that used to read Google.
export async function rowsOfKind(kind) {
  const m = await loadMeta(); const s = m.sheets.find((x) => x.kind === kind); if (!s) return null;
  const tabs = [];
  for (const t of s.tabs) tabs.push({ id: t.id, name: t.name, rows: ((await kvGet(tabKey(t.id))) || { rows: [] }).rows });
  return { sheet: s, tabs };
}
