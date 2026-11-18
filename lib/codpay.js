// "COD payments": what TCS has paid you for delivered cash-on-delivery parcels, and what it still owes.
// Source: TCS Payment/detail (one row per parcel booked in the date range). TCS keeps the COD it collects and pays it out
// in batches, so a delivered parcel is "waiting" until its payment date appears.
import { rowsForRange, codOf, isoOf } from "./tools.js";
import { bulkStatuses } from "./report.js";
import { kvEnabled, kvGet, kvMget, kvSetMany } from "./kvstore.js";
import { trackAll } from "./daily.js";

const DAY = 86400000;
const todayPk = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const GROUP = (code) => (code === "OK" ? "delivered" : ["RO", "RT", "RS"].includes(code) ? "returned" : code === "CN" ? "cancelled" : "transit");

// Days a delivered, unpaid parcel has waited for its money: 0-7 normal, 8-12 amber, 13 or more red (TCS normally pays within about 10 days).
export const waitBand = (days) => (days >= 13 ? "bad" : days >= 8 ? "warn" : "ok");
export const waitDays = (deliveredIso, today = todayPk()) => (deliveredIso ? Math.max(0, Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(deliveredIso + "T00:00:00Z")) / DAY)) : 0);
const payDayOf = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || "")); return m ? m[3] + "-" + m[2] + "-" + m[1] : ""; };

// Pure: normalised TCS rows -> the report.
export function buildCodPayments(rows, today = todayPk(), noTracking = new Set()) {
  const out = rows.map((r) => {
    // "Delivered" in the payment list but TCS tracking has never heard of the CN: made, never picked up. Not owed money.
    const group = GROUP(r.status_code) === "delivered" && !r.paid && noTracking.has(String(r.cn)) ? "nodispatch" : GROUP(r.status_code);
    // TCS records the COD value of a parcel it has not paid yet nowhere in the payment list, but the booking list has it.
    let cod = codOf(r);
    if (cod.cod_amount == null && r.bookingValue > 0) cod = { cod_amount: r.bookingValue, cod_source: "booking value" };
    const delivered = isoOf(r.delivered) || "", booked = isoOf(r.booked) || "";
    const waiting = group === "delivered" && !r.paid;
    const days = waiting ? waitDays(delivered, today) : null;
    return {
      cn: r.cn, order: r.order, booked, delivered, city: r.city, group, status: r.status, statusCode: r.status_code,
      paid: !!r.paid, amountPaid: r.amount_paid, payDate: r.payment_date || "", payDay: payDayOf(r.payment_date),
      cod: cod.cod_amount, codSource: cod.cod_source,
      charges: Math.round((r.delivery_charges + r.fuel_surcharge + r.osa_charges + r.sales_tax) * 100) / 100,
      withheld: r.whit, waiting, days, band: waiting ? waitBand(days) : "",
    };
  }).sort((a, b) => (b.waiting - a.waiting) || ((b.days || 0) - (a.days || 0)) || String(b.booked).localeCompare(String(a.booked)));
  const sum = (a, f) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);
  const paid = out.filter((r) => r.paid), waiting = out.filter((r) => r.waiting);
  const byDay = new Map();
  for (const r of paid) { const k = r.payDay || "unknown"; const e = byDay.get(k) || { date: k, parcels: 0, amount: 0, charges: 0 }; e.parcels++; e.amount += r.amountPaid; e.charges += r.charges; byDay.set(k, e); }
  return {
    rows: out,
    totals: {
      parcels: out.length, delivered: out.filter((r) => r.group === "delivered").length, returned: out.filter((r) => r.group === "returned").length,
      transit: out.filter((r) => r.group === "transit").length, cancelled: out.filter((r) => r.group === "cancelled").length,
      paidCount: paid.length, paidAmount: sum(paid, (r) => r.amountPaid),
      waitingCount: waiting.length, waitingAmount: sum(waiting, (r) => r.cod), waitingNoAmount: waiting.filter((r) => r.cod == null).length,
      noTrackingCount: out.filter((r) => r.group === "nodispatch").length, noTrackingCharges: Math.round(sum(out.filter((r) => r.group === "nodispatch"), (r) => r.charges) * 100) / 100,
      late: waiting.filter((r) => r.band === "bad").length, charges: sum(out, (r) => r.charges), withheld: sum(out, (r) => r.withheld),
    },
    payments: [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

// ---- Parcels TCS lists as delivered but that have no tracking history at all: a CN was made, the parcel was never picked up. They are not owed money. ----
const VERDICT = "cs:cnv:";
// Returns the CNs (from the ones given) that TCS tracking has never heard of. A verdict is kept in storage (a parcel with tracking for 30 days,
// one without for 3 days, because a parcel booked a moment ago has none yet); lookups that fail or run out of time are left undecided.
export async function noTrackingSet(cns, budgetMs = 25000) {
  const none = new Set(); let unchecked = 0;
  if (!cns.length) return { none, unchecked };
  let todo = cns.slice();
  if (kvEnabled()) {
    try {
      const rest = [];
      for (let i = 0; i < cns.length; i += 500) {
        const part = cns.slice(i, i + 500);
        const vals = await kvMget(part.map((c) => VERDICT + c));
        part.forEach((c, j) => { const v = vals[j]; if (v && v.ok === false) none.add(c); else if (!(v && v.ok === true)) rest.push(c); });
      }
      todo = rest;
    } catch { todo = cns.slice(); }
  }
  if (!todo.length) return { none, unchecked };
  const tr = await trackAll(todo, false, Date.now() + budgetMs);
  const good = [], bad = [];
  for (const c of todo) {
    const t = tr.map.get(c);
    if (!t || t.failed) { unchecked++; continue; }
    if (t.valid) good.push([VERDICT + c, { ok: true, at: Date.now() }]);
    else { none.add(c); bad.push([VERDICT + c, { ok: false, at: Date.now() }]); }
  }
  if (kvEnabled()) { try { await Promise.all([kvSetMany(good, 30 * 86400), kvSetMany(bad, 3 * 86400)]); } catch { /* next time */ } }
  return { none, unchecked };
}

// ---- TCS is read in fixed 10-day blocks (one after another: TCS answers one request at a time), each kept 20 minutes ----
const BLOCK = 10, KEEP = 20 * 60e3;
const num = (iso) => Math.floor(Date.parse(iso + "T00:00:00Z") / DAY);
const isoNum = (n) => new Date(n * DAY).toISOString().slice(0, 10);
export function blocks(from, to, today = todayPk()) {
  const out = [], last = Math.min(num(to), num(today));
  for (let n = Math.floor(num(from) / BLOCK) * BLOCK; n <= last; n += BLOCK) out.push([isoNum(n), isoNum(Math.min(n + BLOCK - 1, num(today)))]);
  return out;
}
const bkey = (a) => "cs:codb:" + a;
async function fetchBlock([a, b]) {
  let rows;
  try { rows = await rowsForRange(a, b); } catch { rows = await rowsForRange(a, b); }
  const bulk = await bulkStatuses(a, b).catch(() => ({ rows: [] }));
  const val = new Map((bulk.rows || []).map((r) => [String(r.cn), Number(r.amount) || 0]));
  return { at: Date.now(), rows: rows.map((r) => ({ ...r, bookingValue: val.get(String(r.cn)) || 0 })) };
}
const mem = new Map();
async function getBlock(bl, { fetchIt = true } = {}) {
  const hit = mem.get(bl[0]);
  if (hit && Date.now() - hit.at < KEEP) return hit;
  if (kvEnabled()) { try { const v = await kvGet(bkey(bl[0])); if (v && Array.isArray(v.rows) && Date.now() - v.at < KEEP) { mem.set(bl[0], v); return v; } } catch { /* ask TCS */ } }
  if (!fetchIt) return null;
  const v = await fetchBlock(bl);
  mem.set(bl[0], v);
  if (kvEnabled()) { try { await kvSetMany([[bkey(bl[0]), v]], 1500); } catch { /* next time */ } }
  return v;
}
const check = (from, to) => {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO.test(from || "") || !ISO.test(to || "") || to < from) throw new Error("Pick a valid date range.");
  if ((Date.parse(to) - Date.parse(from)) / DAY > 61) throw new Error("Pick a range of 62 days or less.");
};

// Reads the blocks of a range that are not saved yet, one at a time, until the time budget is used. The page calls this until nothing is missing.
export async function codPrepare(from, to, budgetMs = 40000) {
  check(from, to);
  const end = Date.now() + budgetMs, list = blocks(from, to);
  let missing = 0;
  for (const bl of list) {
    if (await getBlock(bl, { fetchIt: false })) continue;
    if (Date.now() + 14000 > end) { missing++; continue; }
    await getBlock(bl);
  }
  return { blocks: list.length, missing };
}

export async function codPayments(from, to) {
  check(from, to);
  const seen = new Set(), rows = [];
  for (const bl of blocks(from, to)) {
    const v = await getBlock(bl);
    for (const r of v.rows) { const d = isoOf(r.booked) || ""; if (d >= from && d <= to && !seen.has(String(r.cn))) { seen.add(String(r.cn)); rows.push(r); } }
  }
  // Delivered but unpaid parcels are the ones that matter: set aside any that tracking has never heard of.
  const first = buildCodPayments(rows, todayPk());
  const { none, unchecked } = await noTrackingSet(first.rows.filter((r) => r.waiting).map((r) => String(r.cn)));
  const built = none.size ? buildCodPayments(rows, todayPk(), none) : first;
  built.totals.unchecked = unchecked;
  return { from, to, pulledAt: new Date().toISOString(), ...built };
}
