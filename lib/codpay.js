// "COD payments": what TCS has paid you for delivered cash-on-delivery parcels, and what it still owes.
// Source: TCS Payment/detail (one row per parcel booked in the date range). TCS keeps the COD it collects and pays it out
// in batches, so a delivered parcel is "waiting" until its payment date appears.
import { rowsForRange, codOf, isoOf } from "./tools.js";
import { bulkStatuses } from "./report.js";

const DAY = 86400000;
const todayPk = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const GROUP = (code) => (code === "OK" ? "delivered" : ["RO", "RT", "RS"].includes(code) ? "returned" : code === "CN" ? "cancelled" : "transit");

// Days a delivered, unpaid parcel has waited for its money: 0-7 normal, 8-12 amber, 13 or more red (TCS normally pays within about 10 days).
export const waitBand = (days) => (days >= 13 ? "bad" : days >= 8 ? "warn" : "ok");
export const waitDays = (deliveredIso, today = todayPk()) => (deliveredIso ? Math.max(0, Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(deliveredIso + "T00:00:00Z")) / DAY)) : 0);
const payDayOf = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || "")); return m ? m[3] + "-" + m[2] + "-" + m[1] : ""; };

// Pure: normalised TCS rows -> the report.
export function buildCodPayments(rows, today = todayPk(), bookingValue = new Map()) {
  const out = rows.map((r) => {
    const group = GROUP(r.status_code);
    // TCS records the COD value of a parcel it has not paid yet nowhere in the payment list, but the booking list has it.
    let cod = codOf(r);
    if (cod.cod_amount == null && bookingValue.get(String(r.cn)) > 0) cod = { cod_amount: bookingValue.get(String(r.cn)), cod_source: "booking value" };
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
      late: waiting.filter((r) => r.band === "bad").length, charges: sum(out, (r) => r.charges), withheld: sum(out, (r) => r.withheld),
    },
    payments: [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export async function codPayments(from, to) {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO.test(from || "") || !ISO.test(to || "") || to < from) throw new Error("Pick a valid date range.");
  if ((Date.parse(to) - Date.parse(from)) / DAY > 61) throw new Error("Pick a range of 62 days or less.");
  // Long ranges are asked from TCS in pieces of 10 days at the same time, which is much quicker than one big request.
  const pieces = [];
  for (let a = from; a <= to; ) {
    const b = new Date(Math.min(Date.parse(a + "T00:00:00Z") + 9 * DAY, Date.parse(to + "T00:00:00Z"))).toISOString().slice(0, 10);
    pieces.push([a, b]); a = new Date(Date.parse(b + "T00:00:00Z") + DAY).toISOString().slice(0, 10);
  }
  const [parts, bulk] = await Promise.all([
    Promise.all(pieces.map(async ([a, b]) => { try { return await rowsForRange(a, b); } catch { return await rowsForRange(a, b); } })),
    bulkStatuses(from, to).catch(() => ({ rows: [] })),
  ]);
  const seen = new Set(), rows = [];
  for (const r of parts.flat()) if (!seen.has(String(r.cn))) { seen.add(String(r.cn)); rows.push(r); }
  const booked = new Map((bulk.rows || []).map((r) => [String(r.cn), Number(r.amount) || 0]));
  return { from, to, pulledAt: new Date().toISOString(), ...buildCodPayments(rows, todayPk(), booked) };
}
