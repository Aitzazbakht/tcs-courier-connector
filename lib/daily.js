// "Total delivery report": the delivery ratio of every order placed on one Pakistan day, across both Shopify stores.
// Parcels booked on TCS are tracked live; Rawalpindi/Islamabad orders delivered by our own rider are matched to the
// courier Google Sheet. Every order lands in exactly one group, and the counts are checked to add up.
import * as tcs from "./tcs.js";
import * as shop from "./shopify.js";
import { perStore } from "./sync.js";
import { stores as storeList } from "./store.js";
import { bulkStatuses } from "./report.js";
import { kvEnabled, kvMget, kvSetMany } from "./kvstore.js";

const DAY = 86400000;
// fetch that gives up after ms, so one slow Google or TCS answer cannot eat the whole 60 seconds Vercel allows
const fetchT = async (url, ms = 10000) => { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms); try { return await fetch(url, { redirect: "follow", cache: "no-store", signal: ctl.signal }); } finally { clearTimeout(t); } };
const giveUp = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timed out")), ms));
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TTL = 15 * 60 * 1000;
const SHEET_ID = () => process.env.COURIER_SHEET_ID || "1bVUYdSsUfA3ZBisuAiRmXy9N719aUUh9ThFiJB6Hjk4";
const SHEET_GID = () => process.env.COURIER_SHEET_GID || "0";

// Pakistan day D runs from (D-1) 19:00 UTC to D 19:00 UTC.
export function pkWindow(date) {
  const d = Date.parse(date + "T00:00:00Z");
  return { start: new Date(d - 5 * 3600e3).toISOString(), end: new Date(d + 19 * 3600e3).toISOString() };
}

// ---------- TCS tracking (cached 15 minutes, Refresh bypasses) ----------
const trackCache = new Map();
const REFUSED = /refused|returned|order cancelled|return(ed)? to/i;
const attemptNote = (t) => String(t || "").replace(/\s*\(For Additional Info[^)]*\)/i, "").trim();

export function readTrack(d) {
  if (!d?.shipmentinfo?.length) return { valid: false };
  const sh = d.shipmentinfo[0];
  const latest = d.deliveryinfo?.[0] || {};
  const cps = d.checkpoints || [];
  const text = attemptNote(cps[0]?.status || latest.status || "");
  const code = String(latest.code || "").toUpperCase();
  let group = "open";
  if (code === "OK" || /^delivered/i.test(String(latest.status || "")) || /^delivered/i.test(text)) group = "delivered";
  else if (["RS", "RO", "RT"].includes(code) || REFUSED.test(String(latest.status || "")) || REFUSED.test(text)) group = "returned";
  const booked = sh.bookingdate ? new Date(sh.bookingdate + " 12:00 UTC") : null;
  const key = /refused|not home|address|closed|shifted|delivered|returned|out for delivery|pending|cancel|reschedul|next delivery|not available|attempt/i;
  const events = cps.filter((c) => key.test(c.status || "")).slice(0, 3)
    .map((c) => `${String(c.datetime || "").replace(/^\w+day\s+/i, "").replace(/\s+\d{1,2}:\d{2}$/, "")}: ${attemptNote(c.status)}`);
  return {
    valid: true, group, state: text || String(latest.status || ""), code, when: cps[0]?.datetime || "",
    booked: booked && !isNaN(booked) ? booked.toISOString().slice(0, 10) : null, events,
  };
}

const shiftIso = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export async function trackAll(cns, refresh, deadline) {
  const out = new Map();
  let hits = 0, fetched = 0, failed = 0;
  const queue = [];
  for (const cn of cns) {
    const c = trackCache.get(cn);
    if (c && (!refresh ? Date.now() - c.at < TTL : c.data.valid && c.data.group !== "open")) { out.set(cn, c.data); hits++; } else queue.push(cn);
  }
  // A delivered or returned parcel never changes, so its answer is kept in Upstash for good (120 days) and shared by every
  // request: once a parcel is final it is never asked from TCS again. Only parcels still on the way go to TCS.
  const keyOf = (cn) => "cs:trk:" + cn;
  const saved = [];
  if (kvEnabled() && queue.length) {
    try {
      const keys = queue.slice();
      for (let i = 0; i < keys.length; i += 500) {
        const part = keys.slice(i, i + 500);
        const vals = await Promise.race([kvMget(part.map(keyOf)), giveUp(4000)]);
        part.forEach((cn, j) => { const v = vals[j]; if (v && v.valid && v.group !== "open") { out.set(cn, v); trackCache.set(cn, { at: Date.now(), data: v }); hits++; } });
      }
      for (let i = queue.length - 1; i >= 0; i--) if (out.has(queue[i])) queue.splice(i, 1);
    } catch { /* storage is only a shortcut: ask TCS instead */ }
  }
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (queue.length && Date.now() < deadline) {
      const cn = queue.shift();
      try {
        const data = readTrack(await tcs.track([cn]));
        trackCache.set(cn, { at: Date.now(), data });
        if (data.valid && data.group !== "open") saved.push([keyOf(cn), data]);
        out.set(cn, data); fetched++;
      } catch (e) {
        // TCS answers unknown numbers with an error status; anything else is a failed lookup, not "invalid"
        if (/HTTP 4\d\d|invalid|no data/i.test(e.message)) { const data = { valid: false }; trackCache.set(cn, { at: Date.now(), data }); out.set(cn, data); fetched++; }
        else { out.set(cn, { valid: false, failed: true }); failed++; }
      }
    }
  }));
  for (const cn of queue) { out.set(cn, { valid: false, failed: true }); failed++; }
  if (kvEnabled() && saved.length) { try { await Promise.race([kvSetMany(saved, 120 * 86400), giveUp(3000)]); } catch { /* next time */ } }
  return { map: out, hits, fetched, failed };
}

// ---------- Courier sheet ----------
let sheetCache = null;

export function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// "9 Oct 2026" / "12 November 2026" / "9/10/2026" (day first) -> "2026-10-09", or null when the date block is written some other way.
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function blockDay(b) {
  const t = String(b || "").trim();
  let m = /^(\d{1,2})[\s\-]+([A-Za-z]{3,9})\.?,?[\s\-]+(\d{4})$/.exec(t);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].slice(0, 3).toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(t);
  if (m && +m[2] <= 12) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
// A rider cannot deliver an order before it was placed, so a sheet row dated earlier than the order's day is somebody else's delivery.
// Rows under a date block we cannot read are kept (we cannot tell). The upper limit is generous: rider deliveries are normally within days.
export function dayFits(rowBlock, orderDay, maxDays = 60) {
  const d = blockDay(rowBlock);
  if (!d || !orderDay) return true;
  return d >= orderDay && Date.parse(d) - Date.parse(orderDay) <= maxDays * 86400000;
}

const STATUS = (s) => { const t = String(s || "").trim().toUpperCase().replace(/[.\s]+$/, ""); return /^DELI?V(E|ER|ERE|ERED|ERD|RD|D)?$/.test(t) ? "delivered" : /^(CANC(E?L+E?D?)?|CNCL|CANCLD)$/.test(t) ? "failed" : /^PROC/.test(t) ? "open" : null; };
const SKIP = /rider\s*amount|^\s*online\s*$|^\s*cash\s*$|\bonline\b.*\d|\bcash\b.*\d/i;
const isDateHeader = (cells) => {
  const nz = cells.filter((c) => c.trim());
  return nz.length >= 1 && nz.length <= 2 && /^\d{1,2}[\s/.\-](\d{1,2}|[A-Za-z]{3,9})([\s/.\-]\d{2,4})?$|^[A-Za-z]{3,9}\.?\s+\d{1,2}(,?\s*\d{4})?$/.test(nz[0].trim()) && !STATUS(nz[nz.length - 1]);
};

// A header cell that names the Shopify order number column ("Order", "Order #", "Shopify order", "Order No"...).
const ORDER_HEAD = /^(?!.*(amount|rider|status|date|name|city|cod))(?=.*(order|shopify|ord\b)).{2,26}$/i;
const orderOf = (c) => { const m = /^\s*#?\s*(\d{4,6})\s*$/.exec(String(c || "")); return m ? m[1] : null; };

// No header names the order column? Use the column whose cells are mostly 5-digit order numbers (52379, #26906).
function guessOrderCol(rows) {
  const hits = new Map(); let n = 0;
  for (const cells of rows) {
    if (!cells.some((c) => STATUS(c))) continue;
    n++;
    cells.forEach((c, k) => { if (/^\s*#?\s*\d{5}\s*$/.test(c)) hits.set(k, (hits.get(k) || 0) + 1); });
  }
  let best = -1, top = 0;
  for (const [k, v] of hits) if (v > top) { top = v; best = k; }
  return n >= 3 && top >= 3 && top >= 0.4 * n ? best : -1;
}

export function parseSheet(rows) {
  const out = []; let block = ""; let ocol = -1; const guess = guessOrderCol(rows);
  rows.forEach((cells, i) => {
    const hc = cells.findIndex((c) => ORDER_HEAD.test(c));
    if (hc >= 0 && !cells.some((c) => STATUS(c))) { ocol = hc; return; } // header row: remember where the order number column is
    if (isDateHeader(cells)) { block = cells.find((c) => c.trim()).trim(); return; }
    const joined = cells.join(" ");
    if (SKIP.test(joined) && !cells.some((c) => STATUS(c))) return;
    const status = cells.map(STATUS).find(Boolean);
    if (!status) return;
    // Order number: the column named in the header, else any cell written like "#52503".
    let order = ocol >= 0 ? orderOf(cells[ocol]) : null, oi = order ? ocol : -1;
    if (!order && guess >= 0) { order = orderOf(cells[guess]); oi = order ? guess : -1; }
    if (!order) { oi = cells.findIndex((c) => /^\s*#\s*\d{4,6}\s*$/.test(c)); order = oi >= 0 ? orderOf(cells[oi]) : null; }
    const rest = cells.map((c, k) => (k === oi ? "" : c));
    const nums = rest.map((c) => String(c).replace(/[,\s]|rs\.?/gi, "")).filter((c) => /^\d+(\.\d+)?$/.test(c));
    const amount = nums.length ? Math.round(Number(nums[0])) : null;
    const name = rest.find((c) => /[A-Za-z\u0600-\u06FF]{2}/.test(c) && !STATUS(c) && !SKIP.test(c));
    if (amount == null) return;
    if (!name && !order) return;
    out.push({ name: (name || "").trim(), amount, status, block, line: i + 1, order });
  });
  return out;
}

// The courier sheet has one tab per rider group (Lahore, Isb/Rwp, ...). Find every tab's id from the sheet page itself;
// COURIER_SHEET_GIDS (comma separated) overrides this, and tab 0 is always tried.
async function sheetGids() {
  if (process.env.COURIER_SHEET_GIDS) return process.env.COURIER_SHEET_GIDS.split(",").map((x) => x.trim()).filter(Boolean);
  const ids = new Set([SHEET_GID()]);
  try {
    const r = await fetchT(`https://docs.google.com/spreadsheets/d/${SHEET_ID()}/edit`, 8000);
    const html = await r.text();
    for (const m of html.matchAll(/[?&#]gid=(\d{1,12})/g)) ids.add(m[1]);
    for (const m of html.matchAll(/\\?"sheetId\\?"\s*:\s*(\d{1,12})/g)) ids.add(m[1]);
    for (const m of html.matchAll(/\[\d+,\d+,\\?"[^"\\]{1,60}\\?",\d+,\d+,(\d{1,12})\]/g)) ids.add(m[1]);
  } catch {}
  return [...ids].slice(0, 15);
}

async function loadOwnSheet() {
  let own = null; try { own = await (await import("./sheets.js")).rowsOfKind("courier"); } catch { return null; }
  if (!own) return null;
  const rows = own.tabs.flatMap((t) => parseSheet(t.rows).map((r) => ({ ...r, tab: t.name })));
  const data = { rows, lines: rows.length, tabs: own.tabs.map((t) => t.name), tabErrors: [] };
  sheetCache = { at: Date.now(), data };
  return data;
}
async function loadSheet(refresh) {
  // Once the courier sheet has been copied into the Sheets tab (kind "courier"), that copy is used instead of Google.
  if (kvEnabled()) { const o = await loadOwnSheet(); if (o) return o; }
  // The sheet is read fresh on every report (it is small and changes all day); only TCS results are cached.
  const gids = await sheetGids();
  const parts = await Promise.all(gids.map(async (gid) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID()}/export?format=csv&gid=${gid}&_=${Date.now()}`;
    try {
      const res = await fetchT(url, 10000);
      const text = await res.text();
      if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) return { gid, error: `HTTP ${res.status}${/<html/i.test(text) ? " (sheet is not shared as 'anyone with the link can view')" : ""}` };
      return { gid, rows: parseSheet(parseCsv(text)).map((r) => ({ ...r, tab: gid })), lines: text.split(/\r?\n/).length };
    } catch (e) { return { gid, error: e.message }; }
  }));
  const ok = parts.filter((p) => p.rows);
  if (!ok.length) throw new Error(parts.map((p) => p.error).filter(Boolean)[0] || "no tab could be read");
  const data = { rows: ok.flatMap((p) => p.rows), lines: ok.reduce((t, p) => t + p.lines, 0), tabs: ok.map((p) => p.gid), tabErrors: parts.filter((p) => p.error).map((p) => p.gid + ": " + p.error) };
  sheetCache = { at: Date.now(), data };
  return data;
}

// ---------- Fuzzy name match ----------
const toks = (s) => String(s || "").toLowerCase().replace(/[^a-z؀-ۿ ]+/g, " ").split(/\s+/).filter((t) => t.length > 1);
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const close = (a, b) => a === b || (Math.min(a.length, b.length) >= 3 && lev(a, b) / Math.max(a.length, b.length) <= 0.5);
export function nameScore(a, b) {
  const x = toks(a), y = toks(b); let s = 0;
  for (const t of x) if (y.some((u) => close(t, u))) s++;
  return s;
}

// ---------- Report ----------
// Customers sometimes leave the city on the checkout placeholder ("Select"), so also read the city from the address text.
const RIDER_RE = /rawalpindi|islamabad|pindi|\b(rwp|isb)\b/i;
export function shipCity(a) {
  const c = String(a?.city || "").trim();
  if (RIDER_RE.test(c)) return c;
  const m = RIDER_RE.exec(`${a?.address1 || ""} ${a?.address2 || ""}`);
  if (!m) return c;
  return /rawalpindi|pindi|rwp/i.test(m[0]) ? "Rawalpindi" : "Islamabad";
}
// Spelling varies in orders (Urdu script, typos like "Islamabaf"), so match loosely.
const cityIsRider = (c) => /rawal|pindi|islam|isl\w{2,6}ab|rwp|\bisb\b|اسلام|راولپنڈی|پنڈی/i.test(String(c || ""));
const clean = (s) => String(s || "").trim();
const money = (n) => Math.round(Number(n) || 0);

// ---------- Orders kept in Upstash, one entry per Pakistan day (both stores) ----------
const pkDay = (iso) => new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(0, 10);
const todayPk = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY);
const eachDay = (a, b) => { const o = []; for (let d = a; d <= b; d = shiftIso(d, 1)) o.push(d); return o; };
// How long a saved day can be trusted: today and yesterday change all the time (new orders, tags, cancellations),
// older days settle, and from 14 days on a day is final.
export function dayFresh(day, savedAt, today = todayPk(), refresh = false) {
  const age = daysBetween(day, today);
  if (age >= 14) return true;
  if (refresh) return false;
  const ttl = age <= 0 ? 5 * 60e3 : age <= 2 ? 30 * 60e3 : 6 * 3600e3;
  return Date.now() - savedAt < ttl;
}
const cnOfRaw = (o) => {
  const tags = o.tags || [];
  return tags.map((t) => /^TCS-(\d{6,})$/i.exec(t)?.[1]).find(Boolean)
    || (o.fulfillments || []).flatMap((f) => f.trackingInfo || []).map((t) => /^\d{6,}$/.test(clean(t.number)) ? clean(t.number) : null).find(Boolean) || null;
};
export async function ordersForRange(date, to, refresh = false) {
  const fetchWin = (a, b) => perStore(async () => (await shop.listCreatedBetween(pkWindow(a).start, pkWindow(b).end)));
  if (!kvEnabled()) return fetchWin(date, to);
  const days = eachDay(date, to), today = todayPk(), have = new Map();
  try {
    const vals = [];
    for (let i = 0; i < days.length; i += 100) vals.push(...await Promise.race([kvMget(days.slice(i, i + 100).map((d) => "cs:ord:" + d)), giveUp(4000)]));
    days.forEach((d, i) => { const v = vals[i]; if (v && Array.isArray(v.rows) && dayFresh(d, v.at, today, refresh)) have.set(d, v.rows); });
  } catch { /* storage is a shortcut only */ }
  const missing = days.filter((d) => !have.has(d));
  let errors = [];
  if (missing.length) {
    const r = await fetchWin(missing[0], missing[missing.length - 1]);
    errors = r.errors;
    const byDay = new Map(missing.map((d) => [d, []]));
    for (const o of r.rows) { const d = pkDay(o.createdAt); if (byDay.has(d)) byDay.get(d).push(o); }
    for (const [d, rows] of byDay) have.set(d, rows);
    // a store that failed leaves holes, so nothing is saved from this read
    if (!errors.length) { try { await Promise.race([kvSetMany([...byDay].map(([d, rows]) => ["cs:ord:" + d, { at: Date.now(), rows }]), 120 * 86400), giveUp(4000)]); } catch { /* next time */ } }
  }
  return { rows: days.flatMap((d) => have.get(d) || []), errors };
}

// Reads and remembers the orders and the final TCS answers of a short range (at most 15 days), so the big report is quick.
export async function warmRange(date, to, { refresh = false, budgetMs = 40000 } = {}) {
  if (!ISO.test(date || "") || !ISO.test(to || "") || to < date) throw new Error("Pick a valid date range.");
  if (daysBetween(date, to) > 15) throw new Error("Warm-up takes 16 days at most per call.");
  if (to > todayPk()) to = todayPk();
  const deadline = Date.now() + budgetMs;
  const { rows, errors } = await ordersForRange(date, to, refresh);
  const cns = [...new Set(rows.filter((o) => !o.cancelledAt && !(o.tags || []).some((t) => /^fake-order$/i.test(t))).map(cnOfRaw).filter(Boolean))];
  const tr = await trackAll(cns, false, deadline);
  return { from: date, to, orders: rows.length, parcels: cns.length, fromStorage: tr.hits, fetched: tr.fetched, pending: tr.failed, errors };
}

export async function dailyReport(date, { refresh = false, to = "", detail = false } = {}) {
  if (!ISO.test(date || "")) throw new Error("Pick a valid order date.");
  to = ISO.test(to || "") ? to : date;
  if (to < date) throw new Error("The end date is before the start date.");
  if ((Date.parse(to) - Date.parse(date)) / 86400000 > (kvEnabled() ? 119 : 30)) throw new Error(kvEnabled() ? "Pick a range of 120 days or less." : "Pick a range of 31 days or less.");
  const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  if (date > today || to > today) throw new Error("That date is in the future.");
  const deadline = Date.now() + 34000; // TCS lookups stop here, which leaves time for the fallback list, the courier sheet and the answer
  const win = { start: pkWindow(date).start, end: pkWindow(to).end };
  const warnings = [];

  // 1. Orders from both stores, same UTC window
  const { rows: raw, errors } = await ordersForRange(date, to, refresh);
  for (const e of errors) warnings.push(`${e.store}: couldn't read orders (${e.error})`);
  if (errors.length >= storeList().length) throw new Error("Couldn't read orders from any store. " + errors[0].error);
  const orders = raw.map((o) => {
    const tags = o.tags || [];
    const cn = cnOfRaw(o);
    return {
      store: o.store, storeLabel: o.storeLabel, name: o.name, createdAt: o.createdAt, tags, cn,
      cancelled: !!o.cancelledAt || tags.some((t) => /^fake-order$/i.test(t)),
      cancelReason: o.cancelledAt ? "cancelled" : tags.some((t) => /^fake-order$/i.test(t)) ? "fake order" : "",
      amount: money(o.totalPriceSet?.shopMoney?.amount), city: clean(shipCity(o.shippingAddress)), customer: clean(o.shippingAddress?.name),
    };
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // 2. TCS tracking for every non-cancelled order with a number
  const live = orders.filter((o) => !o.cancelled);
  const cns = [...new Set(live.filter((o) => o.cn).map((o) => o.cn))];
  // a big range: ask TCS for the bulk status list at the same time, as the fallback for lookups that run out of time
  const bulkP = cns.length > 40 ? bulkStatuses(shiftIso(date, -4), to).catch(() => null) : null;
  const tr = await trackAll(cns, refresh, deadline);
  // One-by-one lookups that did not finish in time: use TCS's bulk status list (a handful of calls for the whole range) instead.
  if (tr.failed) {
    try {
      const bs = await Promise.race([bulkP || bulkStatuses(shiftIso(date, -4), to), giveUp(14000)]);
      if (!bs) throw new Error("no bulk list");
      const byCn = new Map(bs.rows.map((r) => [String(r.cn), r]));
      for (const [cn, v] of tr.map) {
        if (!v.failed) continue;
        const b = byCn.get(String(cn));
        if (!b) continue;
        const group = b.status_code === "OK" ? "delivered" : ["RO", "RS", "RT", "CN"].includes(b.status_code) ? "returned" : "open";
        tr.map.set(cn, { valid: true, group, state: b.status_code === "OK" ? "Delivered" : b.status_code === "CN" ? "Cancelled" : group === "returned" ? "Returned" : "In process", code: b.status_code, when: "", booked: null, events: [], bulk: true });
        tr.failed--;
      }
    } catch {}
  }
  if (tr.failed) warnings.push(`${tr.failed} TCS lookup(s) failed, those orders are listed under "needs manual check". Press Refresh to retry.`);

  // 3. Courier sheet, only if some order needs it
  const needSheet = live.filter((o) => !o.cn || !tr.map.get(o.cn)?.valid);
  let sheet = null, sheetWarn = "";
  if (needSheet.length) {
    try { sheet = await loadSheet(refresh); if (!sheet.rows.length) { sheetWarn = "The courier sheet was read but no rider rows were recognised."; sheet = null; } }
    catch (e) { sheetWarn = "The courier sheet could not be read (" + e.message + "). Orders without a valid TCS number are listed under needs manual check."; }
    if (sheetWarn) warnings.push(sheetWarn);
    else if (sheet && sheet.tabErrors && sheet.tabErrors.length) warnings.push("Some courier sheet tabs could not be read: " + sheet.tabErrors.join("; "));
  }

  // 4. Classify
  const fakeNames = new Set(orders.filter((o) => o.cancelled).map((o) => toks(o.customer).join(" ")).filter(Boolean));
  const used = new Set();
  const group = new Map(); // order -> {g, ...}
  const rider = [];
  for (const o of live) {
    const t = o.cn ? tr.map.get(o.cn) : null;
    if (t?.valid) { group.set(o, { g: "tcs", outcome: t.group, t }); continue; }
    rider.push({ o, t });
  }
  const candidates = (o) => !sheet ? [] : sheet.rows.filter((r) => !used.has(r) && !(r.order && r.order !== String(o.name).replace(/^#/, "")) && r.amount === o.amount && dayFits(r.block, new Date(Date.parse(o.createdAt) + 5 * 3600e3).toISOString().slice(0, 10)) && nameScore(o.customer, r.name) > 0)
    .map((r) => ({ r, s: nameScore(o.customer, r.name) }));
  const riderEligible = rider.filter(({ o }) => cityIsRider(o.city));
  // Being on the sheet with the same amount and a similar name is enough to confirm a rider order.
  // pass 1: only one row fits; pass 2: one best-scoring row; pass 3: several equal rows, take the first unused one
  // (each sheet row is still used for one order only)
  // pass 0: the sheet row carries the Shopify order number - match on that (each row once)
  if (sheet) {
    const byOrder = new Map();
    for (const r of sheet.rows) if (r.order && !byOrder.has(r.order)) byOrder.set(r.order, r);
    for (const { o } of rider) { // an order number on the sheet settles it, whatever the city is spelled like
      const r = byOrder.get(String(o.name).replace(/^#/, ""));
      if (r && !used.has(r)) { used.add(r); group.set(o, { g: "rider", outcome: r.status, row: r }); }
    }
  }
  for (const pass of [1, 2, 3]) {
    for (const { o } of riderEligible) {
      if (group.has(o)) continue;
      const c = candidates(o).sort((a, b) => b.s - a.s);
      if (!c.length) continue;
      const top = c.filter((x) => x.s === c[0].s);
      if (pass === 1 ? c.length === 1 : pass === 2 ? top.length === 1 : true) { used.add(top[0].r); group.set(o, { g: "rider", outcome: top[0].r.status, row: top[0].r }); }
    }
  }
  for (const { o, t } of rider) {
    if (group.has(o)) continue;
    let why;
    if (o.tags.some((x) => /^wa-cancelled$/i.test(x))) why = "tagged wa-cancelled";
    else if (!o.cn) why = "no TCS number";
    else if (t?.failed) why = "TCS lookup failed, press Refresh";
    else why = "TCS says invalid number";
    if (!cityIsRider(o.city)) why += `, city ${o.city || "unknown"} is not a rider city`;
    else if (!sheet) why += ", courier sheet unavailable";
    else {
      const withNo = sheet.rows.filter((r) => r.order).length;
      const own = sheet.rows.find((r) => r.order === String(o.name).replace(/^#/, ""));
      if (own) why += ", the sheet lists this order number (" + own.name + ", Rs " + own.amount + ", " + own.status + ") but it could not be used";
      else why += withNo ? " (sheet order numbers read: " + withNo + " rows, none is " + o.name + ")" : " (no order numbers could be read from the sheet)";
      const all = sheet.rows.filter((r) => r.amount === o.amount && nameScore(o.customer, r.name) > 0);
      if (all.length) why += ", its sheet row (" + all[0].name + ", Rs " + all[0].amount + ", " + all[0].status + (all[0].block ? ", " + all[0].block : "") + ") is already used by another order";
      else {
        why += ", not matched on the courier sheet";
        const amt = sheet.rows.filter((r) => r.amount === o.amount).slice(0, 3).map((r) => r.name + " (" + r.status + ")");
        const nm = sheet.rows.filter((r) => nameScore(o.customer, r.name) > 0).slice(0, 3).map((r) => r.name + " Rs " + r.amount + " (" + r.status + ")");
        if (amt.length) why += "; sheet rows with Rs " + o.amount + ": " + amt.join(", ");
        if (nm.length) why += "; sheet rows with a similar name: " + nm.join(", ");
        if (!amt.length && !nm.length) why += "; no sheet row has this amount or name";
      }
    }
    if (fakeNames.has(toks(o.customer).join(" "))) why += ", same name as fake orders";
    group.set(o, { g: "unaccounted", why });
  }

  // 5. Numbers
  const bucket = (o) => { const g = group.get(o); if (g.g === "unaccounted") return "unaccounted"; return g.outcome === "delivered" ? (g.g === "rider" ? "deliveredRider" : "deliveredTcs") : g.outcome === "returned" || g.outcome === "failed" ? "failed" : "open"; };
  const cnt = () => ({ shipped: 0, deliveredTcs: 0, deliveredRider: 0, failed: 0, open: 0, unaccounted: 0 });
  const total = cnt(), byStore = new Map();
  for (const o of live) {
    const b = bucket(o);
    const s = byStore.get(o.store) || { store: o.store, label: o.storeLabel, total: 0, cancelled: 0, ...cnt(), first: null, last: null };
    byStore.set(o.store, s);
    total.shipped++; total[b]++; s.shipped++; s[b]++;
  }
  for (const o of orders) {
    const s = byStore.get(o.store) || { store: o.store, label: o.storeLabel, total: 0, cancelled: 0, ...cnt(), first: null, last: null };
    byStore.set(o.store, s);
    s.total++; if (o.cancelled) s.cancelled++;
    const n = Number(String(o.name).replace(/\D/g, "")) || 0;
    s.first = s.first == null || n < s.first ? n : s.first; s.last = s.last == null || n > s.last ? n : s.last;
  }
  const delivered = total.deliveredTcs + total.deliveredRider;
  const shipped = total.shipped, cancelled = orders.length - shipped;
  // Orders we could not trace (not accounted for) are listed for manual check but are NOT part of the ratio.
  const counted = shipped - total.unaccounted;
  const ratio = (n, d) => (d ? +((100 * n) / d).toFixed(1) : null);
  const stores = [...byStore.values()].map((s) => {
    const d = s.deliveredTcs + s.deliveredRider;
    const c = s.shipped - s.unaccounted;
    return { ...s, delivered: d, counted: c, ratio: ratio(d, c), small: c < 5 };
  });
  const rl = [...group.entries()].filter(([, g]) => g.g === "rider");
  const rDel = rl.filter(([, g]) => g.outcome === "delivered").length, rFail = rl.filter(([, g]) => g.outcome === "failed" || g.outcome === "returned").length;
  const local = { total: rl.length, delivered: rDel, failed: rFail, open: rl.length - rDel - rFail, ratio: ratio(rDel, rl.length) };
  const split = { cancelled, rider: [...group.values()].filter((g) => g.g === "rider").length, tcs: [...group.values()].filter((g) => g.g === "tcs").length, unaccounted: total.unaccounted, total: orders.length };

  // Per order day (Pakistan time): overall ratio and ISB/RWP ratio, for the chart under the ratios.
  const perDay = new Map();
  for (const o of live) {
    const g = group.get(o), day = new Date(Date.parse(o.createdAt) + 5 * 3600e3).toISOString().slice(0, 10);
    const x = perDay.get(day) || { day, counted: 0, delivered: 0, riderTotal: 0, riderDelivered: 0, amt: 0, amtDel: 0, rAmt: 0, rAmtDel: 0 };
    perDay.set(day, x);
    if (g.g !== "unaccounted") { x.counted++; x.amt += o.amount || 0; if (g.outcome === "delivered") { x.delivered++; x.amtDel += o.amount || 0; } }
    if (g.g === "rider") { x.riderTotal++; x.rAmt += o.amount || 0; if (g.outcome === "delivered") { x.riderDelivered++; x.rAmtDel += o.amount || 0; } }
  }
  const daily = [...perDay.values()].sort((a, b) => a.day.localeCompare(b.day))
    .map((x) => ({ ...x, ratio: ratio(x.delivered, x.counted), localRatio: ratio(x.riderDelivered, x.riderTotal), amtRatio: ratio(x.amtDel, x.amt), localAmtRatio: ratio(x.rAmtDel, x.rAmt) }));

  // Whole selected range, for the summary under the two charts (by parcels and by order value).
  const sum = { all: [0, 0, 0, 0], rider: [0, 0, 0, 0], tcs: [0, 0, 0, 0] }; // [parcels, delivered, Rs, delivered Rs]
  for (const o of live) {
    const g = group.get(o); if (g.g === "unaccounted") continue;
    const d = g.outcome === "delivered";
    for (const k of ["all", g.g === "rider" ? "rider" : "tcs"]) { const a = sum[k]; a[0]++; a[2] += o.amount || 0; if (d) { a[1]++; a[3] += o.amount || 0; } }
  }
  const rangeSummary = Object.fromEntries(Object.entries(sum).map(([k, a]) => [k, { parcels: a[0], delivered: a[1], amount: a[2], amountDelivered: a[3], ratio: ratio(a[1], a[0]), amountRatio: ratio(a[3], a[2]) }]));

  const bookedDays = {};
  for (const g of group.values()) if (g.g === "tcs" && g.t.booked) bookedDays[g.t.booked] = (bookedDays[g.t.booked] || 0) + 1;

  // 6. Detail lists
  const sent = (o, g) => {
    if (g.g === "tcs") return `${o.city || "City unknown"}. ${g.t.events.length ? g.t.events.join("; ") + ". " : ""}${g.t.events[0] && g.t.events[0].endsWith(g.t.state) ? "" : "Now: " + (g.t.state || "no update") + "."}`.trim();
    if (g.g === "rider") return `${o.city}. ISB/RWP delivery, courier sheet (${g.row.block || "date unknown"}): ${g.row.status === "failed" ? "cancelled" : g.row.status === "open" ? "still processing" : "delivered"}.`;
    return `${o.city || "City unknown"}. ${g.why[0].toUpperCase() + g.why.slice(1)}.`;
  };
  const item = (o, text) => ({ order: o.name, cn: o.cn || "", store: o.storeLabel, detail: text, amount: o.amount });
  const lists = {
    cancelled: orders.filter((o) => o.cancelled).map((o) => item(o, `${o.city || "City unknown"}. ${o.cancelReason === "fake order" ? "Marked as a fake order." : "Cancelled."}`)),
    failed: live.filter((o) => bucket(o) === "failed").map((o) => item(o, sent(o, group.get(o)))),
    open: live.filter((o) => bucket(o) === "open").map((o) => item(o, sent(o, group.get(o)))),
    rider: live.filter((o) => group.get(o).g === "rider").map((o) => ({ ...item(o, sent(o, group.get(o))), city: o.city, status: group.get(o).row.status === "failed" ? "Returned" : group.get(o).row.status === "open" ? "Still open" : "Delivered" })),
    manual: live.filter((o) => bucket(o) === "unaccounted").map((o) => item(o, sent(o, group.get(o)))),
  };

  // 7. Checks
  const checks = [
    { name: "Delivered + returned + open + unaccounted = shipped", ok: delivered + total.failed + total.open + total.unaccounted === shipped },
    { name: "Cancelled + rider + booked on TCS + unaccounted = total orders", ok: split.cancelled + split.rider + split.tcs + split.unaccounted === split.total },
    { name: "Every order is in exactly one group", ok: group.size === shipped },
    { name: "Each courier sheet row used at most once", ok: [...group.values()].filter((g) => g.row).length === used.size },
    { name: "Every rider order has a sheet row", ok: [...group.values()].filter((g) => g.g === "rider").every((g) => g.row) },
  ];
  for (const c of checks) if (!c.ok) warnings.push("Check failed: " + c.name);

  return {
    date, dateTo: to, window: { start: win.start, end: win.end, note: `Pakistan ${date === to ? "day " + date : "days " + date + " to " + to} = ${win.start} to ${win.end} (UTC)` },
    refreshed: !!refresh, cache: { reused: tr.hits, fetched: tr.fetched },
    sheet: sheet ? { rows: sheet.rows.length, tabs: sheet.tabs, withOrderNo: sheet.rows.filter((r) => r.order).length, fetchedAt: new Date().toISOString() } : null,
    warnings, checks,
    totals: { orders: orders.length, shipped, counted, cancelled, delivered, ...total, ratio: ratio(delivered, counted) },
    scenarios: {
      best: { delivered: delivered + total.open, ratio: ratio(delivered + total.open, counted) },
      worst: { delivered, failures: total.failed + total.open, ratio: ratio(delivered, counted) },
      withCancelled: { ratio: ratio(delivered, counted + cancelled), base: counted + cancelled },
    },
    local, stores, split, bookedDays, lists, daily, rangeSummary,
    // Only when asked (the profit report): what happened to each live order, in the same groups used above.
    ...(detail ? { rows: live.map((o) => {
      const g = group.get(o);
      const state = g.g === "tcs" ? g.t.state : g.g === "rider" ? (g.row.status === "failed" ? "Returned" : g.row.status === "open" ? "Still open" : "Delivered") + " (ISB/RWP rider)" : g.why;
      return { store: o.store, order: o.name, kind: g.g, bucket: bucket(o), state };
    }) } : {}),
  };
}

// Nightly job: save the last 15 days again (new orders, new final parcels), then walk backwards one 15-day block per night
// until everything since the start date (21 Oct) is saved. Progress is kept in storage.
const WARM_START = "2026-10-21";
export async function nightlyWarm() {
  if (!kvEnabled()) return { skipped: "storage is not connected" };
  const t0 = Date.now(), today = todayPk(), out = {};
  out.recent = await warmRange(shiftIso(today, -14), today, { refresh: true, budgetMs: 26000 });
  const { kvGet, kvSet } = await import("./kvstore.js");
  const st = (await kvGet("cs:warm:back")) || { back: shiftIso(today, -14) };
  if (st.back > WARM_START && Date.now() - t0 < 30000) {
    const to = shiftIso(st.back, -1), from = shiftIso(to, -14) < WARM_START ? WARM_START : shiftIso(to, -14);
    out.back = await warmRange(from, to, { budgetMs: Math.max(8000, 52000 - (Date.now() - t0)) });
    if (!out.back.pending) { await kvSet("cs:warm:back", { back: from, at: new Date().toISOString() }); }
    out.backDone = !out.back.pending && from <= WARM_START;
  } else out.backDone = st.back <= WARM_START;
  return out;
}
