// "Total delivery report": the delivery ratio of every order placed on one Pakistan day, across both Shopify stores.
// Parcels booked on TCS are tracked live; Rawalpindi/Islamabad orders delivered by our own rider are matched to the
// courier Google Sheet. Every order lands in exactly one group, and the counts are checked to add up.
import * as tcs from "./tcs.js";
import * as shop from "./shopify.js";
import { perStore } from "./sync.js";
import { stores as storeList } from "./store.js";

const DAY = 86400000;
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

export async function trackAll(cns, refresh, deadline) {
  const out = new Map();
  let hits = 0, fetched = 0, failed = 0;
  const queue = [];
  for (const cn of cns) {
    const c = trackCache.get(cn);
    if (!refresh && c && Date.now() - c.at < TTL) { out.set(cn, c.data); hits++; } else queue.push(cn);
  }
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length && Date.now() < deadline) {
      const cn = queue.shift();
      try {
        const data = readTrack(await tcs.track([cn]));
        trackCache.set(cn, { at: Date.now(), data });
        out.set(cn, data); fetched++;
      } catch (e) {
        // TCS answers unknown numbers with an error status; anything else is a failed lookup, not "invalid"
        if (/HTTP 4\d\d|invalid|no data/i.test(e.message)) { const data = { valid: false }; trackCache.set(cn, { at: Date.now(), data }); out.set(cn, data); fetched++; }
        else { out.set(cn, { valid: false, failed: true }); failed++; }
      }
    }
  }));
  for (const cn of queue) { out.set(cn, { valid: false, failed: true }); failed++; }
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

const STATUS = (s) => { const t = String(s || "").trim().toUpperCase(); return /^DELIVER(E)?D$/.test(t) ? "delivered" : /^CANCEL?L?E?D?$|^CANCL$/.test(t) ? "failed" : /^PROCESS/.test(t) ? "open" : null; };
const SKIP = /rider\s*amount|^\s*online\s*$|^\s*cash\s*$|\bonline\b.*\d|\bcash\b.*\d/i;
const isDateHeader = (cells) => {
  const nz = cells.filter((c) => c.trim());
  return nz.length >= 1 && nz.length <= 2 && /^\d{1,2}[\s/.\-](\d{1,2}|[A-Za-z]{3,9})([\s/.\-]\d{2,4})?$|^[A-Za-z]{3,9}\.?\s+\d{1,2}(,?\s*\d{4})?$/.test(nz[0].trim()) && !STATUS(nz[nz.length - 1]);
};

export function parseSheet(rows) {
  const out = []; let block = "";
  rows.forEach((cells, i) => {
    if (isDateHeader(cells)) { block = cells.find((c) => c.trim()).trim(); return; }
    const joined = cells.join(" ");
    if (SKIP.test(joined) && !cells.some((c) => STATUS(c))) return;
    const status = cells.map(STATUS).find(Boolean);
    if (!status) return;
    const nums = cells.map((c) => String(c).replace(/[,\s]|rs\.?/gi, "")).filter((c) => /^\d+(\.\d+)?$/.test(c));
    const amount = nums.length ? Math.round(Number(nums[0])) : null;
    const name = cells.find((c) => /[A-Za-z؀-ۿ]{2}/.test(c) && !STATUS(c) && !SKIP.test(c));
    if (!name || amount == null) return;
    out.push({ name: name.trim(), amount, status, block, line: i + 1 });
  });
  return out;
}

async function loadSheet(refresh) {
  // The sheet is read fresh on every report (it is small and changes all day); only TCS results are cached.
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID()}/export?format=csv&gid=${SHEET_GID()}&_=${Date.now()}`;
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  const text = await res.text();
  if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) throw new Error(`HTTP ${res.status}${/<html/i.test(text) ? " (sheet is not shared as 'anyone with the link can view')" : ""}`);
  const rows = parseSheet(parseCsv(text));
  const data = { rows, lines: text.split(/\r?\n/).length };
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
const cityIsRider = (c) => /rawalpindi|islamabad|pindi/i.test(String(c || ""));
const clean = (s) => String(s || "").trim();
const money = (n) => Math.round(Number(n) || 0);

export async function dailyReport(date, { refresh = false, to = "" } = {}) {
  if (!ISO.test(date || "")) throw new Error("Pick a valid order date.");
  to = ISO.test(to || "") ? to : date;
  if (to < date) throw new Error("The end date is before the start date.");
  if ((Date.parse(to) - Date.parse(date)) / 86400000 > 30) throw new Error("Pick a range of 31 days or less.");
  const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  if (date > today || to > today) throw new Error("That date is in the future.");
  const deadline = Date.now() + 50000;
  const win = { start: pkWindow(date).start, end: pkWindow(to).end };
  const warnings = [];

  // 1. Orders from both stores, same UTC window
  const { rows: raw, errors } = await perStore(async () => (await shop.listCreatedBetween(win.start, win.end)));
  for (const e of errors) warnings.push(`${e.store}: couldn't read orders (${e.error})`);
  if (errors.length >= storeList().length) throw new Error("Couldn't read orders from any store. " + errors[0].error);
  const orders = raw.map((o) => {
    const tags = o.tags || [];
    const cn = tags.map((t) => /^TCS-(\d{6,})$/i.exec(t)?.[1]).find(Boolean)
      || (o.fulfillments || []).flatMap((f) => f.trackingInfo || []).map((t) => /^\d{6,}$/.test(clean(t.number)) ? clean(t.number) : null).find(Boolean) || null;
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
  const tr = await trackAll(cns, refresh, deadline);
  if (tr.failed) warnings.push(`${tr.failed} TCS lookup(s) failed, those orders are listed under "needs manual check". Press Refresh to retry.`);

  // 3. Courier sheet, only if some order needs it
  const needSheet = live.filter((o) => !o.cn || !tr.map.get(o.cn)?.valid);
  let sheet = null, sheetWarn = "";
  if (needSheet.length) {
    try { sheet = await loadSheet(refresh); if (!sheet.rows.length) { sheetWarn = "The courier sheet was read but no rider rows were recognised."; sheet = null; } }
    catch (e) { sheetWarn = "The courier sheet could not be read (" + e.message + "). Orders without a valid TCS number are listed under needs manual check."; }
    if (sheetWarn) warnings.push(sheetWarn);
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
  const candidates = (o) => !sheet ? [] : sheet.rows.filter((r) => !used.has(r) && r.amount === o.amount && nameScore(o.customer, r.name) > 0)
    .map((r) => ({ r, s: nameScore(o.customer, r.name) }));
  const riderEligible = rider.filter(({ o }) => cityIsRider(o.city));
  // Being on the sheet with the same amount and a similar name is enough to confirm a rider order.
  // pass 1: only one row fits; pass 2: one best-scoring row; pass 3: several equal rows, take the first unused one
  // (each sheet row is still used for one order only)
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
      const c = candidates(o);
      why += ", not on the courier sheet";
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
  const split = { cancelled, rider: [...group.values()].filter((g) => g.g === "rider").length, tcs: [...group.values()].filter((g) => g.g === "tcs").length, unaccounted: total.unaccounted, total: orders.length };

  const bookedDays = {};
  for (const g of group.values()) if (g.g === "tcs" && g.t.booked) bookedDays[g.t.booked] = (bookedDays[g.t.booked] || 0) + 1;

  // 6. Detail lists
  const sent = (o, g) => {
    if (g.g === "tcs") return `${o.city || "City unknown"}. ${g.t.events.length ? g.t.events.join("; ") + ". " : ""}${g.t.events[0] && g.t.events[0].endsWith(g.t.state) ? "" : "Now: " + (g.t.state || "no update") + "."}`.trim();
    if (g.g === "rider") return `${o.city}. Local rider, courier sheet (${g.row.block || "date unknown"}): ${g.row.status === "failed" ? "cancelled" : g.row.status === "open" ? "still processing" : "delivered"}.`;
    return `${o.city || "City unknown"}. ${g.why[0].toUpperCase() + g.why.slice(1)}.`;
  };
  const item = (o, text) => ({ order: o.name, store: o.storeLabel, detail: text, amount: o.amount });
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
    sheet: sheet ? { rows: sheet.rows.length, fetchedAt: new Date().toISOString() } : null,
    warnings, checks,
    totals: { orders: orders.length, shipped, counted, cancelled, delivered, ...total, ratio: ratio(delivered, counted) },
    scenarios: {
      best: { delivered: delivered + total.open, ratio: ratio(delivered + total.open, counted) },
      worst: { delivered, failures: total.failed + total.open, ratio: ratio(delivered, counted) },
      withCancelled: { ratio: ratio(delivered, counted + cancelled), base: counted + cancelled },
    },
    stores, split, bookedDays, lists,
  };
}
