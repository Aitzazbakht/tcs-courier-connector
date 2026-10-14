// City-wise delivery report for the "Delivery report" tab.
// TCS payment/detail works best for ~31 days at a time, so a long range is fetched in
// monthly windows and combined. Parcels are picked by BOOKING date (that is what TCS filters on).
import { rowsForRange, bucketOf, codOf, isoOf } from "./tools.js";
import * as tcs from "./tcs.js";
import { CN_STATUS } from "./tcs.js";
import { tcsCities, matchCity } from "./cities.js";
import { perStore } from "./sync.js";
import * as shop from "./shopify.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;
const MAX_DAYS = 186; // ~6 months; keeps the request inside the 60s function limit
const WINDOW_DAYS = 31;

const toMs = (iso) => Date.parse(iso + "T00:00:00Z");
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);

export function windows(from, to) {
  const out = [];
  for (let s = toMs(from); s <= toMs(to); s += WINDOW_DAYS * DAY) {
    out.push([toIso(s), toIso(Math.min(s + (WINDOW_DAYS - 1) * DAY, toMs(to)))]);
  }
  return out;
}

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (_, a, b) => a + b.toUpperCase());
const pct = (n, d) => (d ? +((100 * n) / d).toFixed(1) : null);

async function fetchWindow([a, b]) {
  try { return { rows: await rowsForRange(a, b) }; }
  catch (e1) {
    try { return { rows: await rowsForRange(a, b) }; } // one retry
    catch (e2) { return { rows: [], error: `${a} to ${b}: ${e2.message}` }; }
  }
}

// TCS's payment list (the only bulk source) only holds parcels that have finished, so parcels still on
// the way are missing from it. Parcels this app booked carry their CN as a Shopify tag, so find those,
// skip the ones TCS already listed, and ask TCS tracking where each one is.
const inLabel = (checkpoint) => {
  const t = String(checkpoint || "");
  if (/out for delivery/i.test(t)) return "Out for delivery";
  if (/refused|not home|not available|address|no such receiver|consignee moved|attempt/i.test(t)) return "Delivery attempted, not delivered";
  return "In transit / not yet updated";
};

async function trackedExtras(from, to, known, cities) {
  const { rows: orders, errors } = await perStore(async () =>
    (await shop.listBookedBetween(from, to)).map((o) => ({
      cn: (o.tags || []).map((t) => /^TCS-(\d{6,})$/i.exec(t)?.[1]).find(Boolean) || null,
      cod: (() => { const m = (o.tags || []).map((t) => /^COD-(\d+)$/i.exec(t)?.[1]).find((x) => x !== undefined); return m === undefined ? null : Number(m); })(),
      cityText: o.shippingAddress?.city || "", address: o.shippingAddress?.address1 || "",
      day: o.bookedAt ? new Date(Date.parse(o.bookedAt) + 5 * 3600e3).toISOString().slice(0, 10) : null,
    })));
  const seen = new Set(known);
  const todo = [];
  for (const o of orders) if (o.cn && !seen.has(o.cn)) { seen.add(o.cn); todo.push(o); }
  todo.length = Math.min(todo.length, 500);
  const rows = [];
  let failed = 0;
  const queue = [...todo];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const o = queue.shift();
      try {
        const d = await tcs.track([o.cn]);
        const info = d?.deliveryinfo?.[0];
        if (!info) { failed++; continue; }
        let code = String(info.code || "").toUpperCase();
        if (!code && /delivered/i.test(info.status || "")) code = "OK";
        const c = matchCity(cities, o.cityText, o.address);
        rows.push({ cn: o.cn, amount: o.cod, booked: o.day, city: c ? c.name : o.cityText || "", status_code: code, inLabel: inLabel(d?.checkpoints?.[0]?.status || info.status) });
      } catch { failed++; }
    }
  }));
  return { rows, failed, errors };
}

// ---- Returned (and delivered-but-unsettled) parcels: real COD value from the Shopify order ----
// TCS lists no COD for returned parcels or for delivered parcels it hasn't paid out yet, but every parcel came from one of the Shopify stores. Parcels this app
// booked carry TCS-<cn> and COD-<n> tags; older ones are matched by consignee name + city + booking date.
const words = (s) => String(s || "").toLowerCase().replace(/[^a-z\u0600-\u06ff0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
const sameCity = (a, b) => { const x = words(a).join(" "), y = words(b).join(" "); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
const nameScore = (a, b) => {
  const x = new Set(words(a)), y = new Set(words(b));
  if (!x.size || !y.size) return 0;
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  if (![...small].every((w) => big.has(w))) return 0;
  return small.size === big.size ? 2 : small.size >= 2 ? 1 : 0;
};
const orderAmount = (o) => {
  const m = (o.tags || []).map((t) => /^COD-(\d+)$/i.exec(t)?.[1]).find((x) => x !== undefined);
  return m !== undefined ? Number(m) : Number(o.totalPriceSet?.shopMoney?.amount) || null;
};
const dayShift = (iso, n) => toIso(toMs(iso) + n * DAY);

async function matchReturned(rows, bookedDay, deadline) {
  const need = rows.filter((r) => ["returned", "delivered"].includes(bucketOf(r.status_code)) && r.amount == null);
  const out = { matched: 0, unmatched: need.length, warnings: [] };
  if (!need.length) return out;
  const days = need.map(bookedDay).filter(Boolean).sort();
  if (!days.length) return out;
  const { rows: orders, errors } = await perStore(async () => {
    const r = await shop.listOrdersForMatch(dayShift(days[0], -21), dayShift(days[days.length - 1], 1), { deadline });
    if (r.truncated) out.warnings.push("Ran out of time reading Shopify orders, so some returned parcels may be unmatched");
    return r.orders;
  });
  for (const e of errors) out.warnings.push(`${e.store}: couldn't read orders (${e.error})`);
  const live = orders.filter((o) => !o.cancelledAt);
  const byCn = new Map();
  for (const o of live) { const cn = (o.tags || []).map((t) => /^TCS-(\d{6,})$/i.exec(t)?.[1]).find(Boolean); if (cn) byCn.set(cn, o); }
  const used = new Set();
  const take = (r, o) => { const a = orderAmount(o); if (a == null) return false; used.add(o); r.amount = a; r.matchedOrder = o.name; return true; };
  const rest = [];
  for (const r of need) { const o = byCn.get(String(r.cn)); if (o && take(r, o)) continue; rest.push(r); }
  // older parcels: look up the consignee name on TCS tracking, then find the order
  const queue = rest.slice();
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (queue.length && Date.now() < deadline) {
      const r = queue.shift();
      try {
        const d = await tcs.track([r.cn]);
        const sh = d?.shipmentinfo?.[0];
        if (!sh) continue;
        const day = bookedDay(r);
        let best = null, bestKey = null;
        for (const o of live) {
          if (used.has(o)) continue;
          const sn = nameScore(sh.consignee, o.shippingAddress?.name);
          if (!sn) continue;
          const od = new Date(Date.parse(o.createdAt) + 5 * 3600e3).toISOString().slice(0, 10);
          if (day && (od > dayShift(day, 1) || od < dayShift(day, -21))) continue;
          const key = [sn, sameCity(sh.destination, o.shippingAddress?.city) ? 1 : 0, day ? -Math.abs((toMs(day) - toMs(od)) / DAY) : 0];
          if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && (key[1] > bestKey[1] || (key[1] === bestKey[1] && key[2] > bestKey[2])))) { best = o; bestKey = key; }
        }
        // a name match with the wrong city is only trusted when the name is an exact match
        if (best && (bestKey[1] === 1 || bestKey[0] === 2)) take(r, best);
      } catch { /* leave unmatched */ }
    }
  }));
  if (queue.length) out.warnings.push(`${queue.length} returned parcel(s) weren't looked up in time, so their amount is missing`);
  out.matched = need.filter((r) => r.amount != null).length;
  out.unmatched = need.length - out.matched;
  return out;
}

function dailyList(map, from, to) {
  const out = [];
  const last = Math.min(toMs(to), toMs(toIso(Date.now() + 5 * 3600e3)));
  for (let d = toMs(from); d <= last; d += DAY) out.push(map.get(toIso(d)) || { day: toIso(d), booked: 0, delivered: 0, returned: 0, inProcess: 0 });
  return out;
}

export async function deliveryReport(from, to) {
  const deadline = Date.now() + 48000;
  if (!ISO.test(from || "") || !ISO.test(to || "")) throw new Error("Pick a valid from and to date.");
  if (from > to) throw new Error("The from date is after the to date.");
  const days = Math.round((toMs(to) - toMs(from)) / DAY) + 1;
  if (days > MAX_DAYS) throw new Error(`Pick a range of ${MAX_DAYS} days (about 6 months) or less. You picked ${days} days.`);

  const wins = windows(from, to);
  // First window alone so the TCS login is cached, then the rest in parallel.
  const first = await fetchWindow(wins[0]);
  const rest = await Promise.all(wins.slice(1).map(fetchWindow));
  const parts = [first, ...rest];
  const warnings = parts.filter((p) => p.error).map((p) => p.error);
  if (warnings.length === parts.length) throw new Error("TCS didn't return data. " + warnings[0]);

  const seen = new Set();
  const rows = [];
  for (const r of parts.flatMap((p) => p.rows)) {
    const k = r.cn || `${r.order}|${r.booked}`;
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push(r);
  }

  // Full city names (TCS rows only carry the 3-letter code, e.g. KHI)
  let cityList = [];
  try { cityList = await tcsCities(); } catch (e) { warnings.push("City names unavailable, showing TCS codes: " + e.message); }
  const nameOf = new Map(cityList.map((c) => [String(c.citycode).toUpperCase(), c.cityname]));
  const fullName = (raw) => nameOf.get(String(raw || "").trim().toUpperCase()) || String(raw || "").trim();

  // Parcels booked through this app that TCS hasn't listed yet
  let supplemented = 0;
  try {
    const x = await trackedExtras(from, to, rows.map((r) => String(r.cn)), cityList);
    rows.push(...x.rows); supplemented = x.rows.length;
    for (const e of x.errors) warnings.push(`${e.store}: couldn't read orders (${e.error})`);
    if (x.failed) warnings.push(`${x.failed} parcel(s) couldn't be tracked, so they are missing`);
  } catch (e) { warnings.push("Couldn't add parcels still on the way: " + e.message); }

  const bookedDay = (r) => (/^\d{4}-/.test(String(r.booked || "")) ? r.booked : isoOf(r.booked));
  for (const r of rows) if (!("amount" in r)) r.amount = codOf(r).cod_amount; // TCS-listed rows: paid / tax-derived amount, else null
  let ret = { matched: 0, unmatched: 0, warnings: [] };
  try { ret = await matchReturned(rows, bookedDay, deadline); }
  catch (e) { warnings.push("Couldn't match returned parcels to Shopify orders: " + e.message); }
  warnings.push(...ret.warnings);

  const daily = new Map();
  const cities = new Map();
  const inProcessStatus = {};
  const t = { booked: 0, delivered: 0, returned: 0, inProcess: 0, cancelled: 0, delA: 0, delNoAmt: 0, retA: 0, retN: 0, retNoAmt: 0 };
  for (const r of rows) {
    const bucket = bucketOf(r.status_code);
    const raw = fullName(r.city);
    const key = raw ? raw.toUpperCase() : "UNKNOWN";
    const c = cities.get(key) || { city: raw ? titleCase(raw) : "Unknown", booked: 0, delivered: 0, returned: 0, inProcess: 0, cancelled: 0, status: {}, delA: 0, delNoAmt: 0, retA: 0, retN: 0, retNoAmt: 0 };
    cities.set(key, c);
    if (bucket === "cancelled") { c.cancelled++; t.cancelled++; continue; } // cancelled parcels are not shipments
    c.booked++; t.booked++;
    // COD value: known for delivered parcels (paid by TCS, or worked out from its tax record) and for parcels
    // booked through this app (COD tag). TCS gives no amount for returned parcels, so those are estimated below.
    const amt = r.amount ?? null;
    const dk = bookedDay(r);
    const dd = dk && (daily.get(dk) || daily.set(dk, { day: dk, booked: 0, delivered: 0, returned: 0, inProcess: 0 }).get(dk));
    if (dd) { dd.booked++; dd[bucket === "delivered" ? "delivered" : bucket === "returned" ? "returned" : "inProcess"]++; }
    if (bucket === "delivered") {
      c.delivered++; t.delivered++;
      if (amt != null) { c.delA += amt; t.delA += amt; } else { c.delNoAmt++; t.delNoAmt++; }
    } else if (bucket === "returned") {
      c.returned++; t.returned++;
      if (amt != null) { c.retA += amt; c.retN++; t.retA += amt; t.retN++; } else { c.retNoAmt++; t.retNoAmt++; }
    }
    else {
      c.inProcess++; t.inProcess++;
      const label = r.inLabel || (r.status_code ? (CN_STATUS[r.status_code] || r.status_code) : "In transit / not yet updated");
      c.status[label] = (c.status[label] || 0) + 1;
      inProcessStatus[label] = (inProcessStatus[label] || 0) + 1;
    }
  }

  const rate = (o) => ({
    ...o,
    deliveredAmount: Math.round(o.delA),
    returnedAmount: Math.round(o.retA),
    returnedNoAmount: o.retNoAmt,
    deliveredNoAmount: o.delNoAmt,
    deliveredAmountPct: pct(o.delA, o.delA + o.retA),
    closed: o.delivered + o.returned,
    deliveredPctClosed: pct(o.delivered, o.delivered + o.returned),
    returnedPctClosed: pct(o.returned, o.delivered + o.returned),
    deliveredPctBooked: pct(o.delivered, o.booked),
  });

  return {
    range: { from, to, days },
    partial: warnings.length > 0,
    supplemented,
    warnings,
    returnMatch: { matched: ret.matched, unmatched: ret.unmatched },
    daily: dailyList(daily, from, to),
    totals: rate(t),
    inProcessStatus,
    cities: [...cities.values()].filter((c) => c.booked || c.cancelled).map(rate).sort((a, b) => b.booked - a.booked || a.city.localeCompare(b.city)),
  };
}
