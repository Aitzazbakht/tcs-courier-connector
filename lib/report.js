// City-wise delivery report for the "Delivery report" tab.
// TCS payment/detail works best for ~31 days at a time, so a long range is fetched in
// monthly windows and combined. Parcels are picked by BOOKING date (that is what TCS filters on).
import { rowsForRange, bucketOf } from "./tools.js";
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
      cityText: o.shippingAddress?.city || "", address: o.shippingAddress?.address1 || "",
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
        rows.push({ cn: o.cn, city: c ? c.name : o.cityText || "", status_code: code, inLabel: inLabel(d?.checkpoints?.[0]?.status || info.status) });
      } catch { failed++; }
    }
  }));
  return { rows, failed, errors };
}

export async function deliveryReport(from, to) {
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

  const cities = new Map();
  const inProcessStatus = {};
  const t = { booked: 0, delivered: 0, returned: 0, inProcess: 0, cancelled: 0 };
  for (const r of rows) {
    const bucket = bucketOf(r.status_code);
    const raw = fullName(r.city);
    const key = raw ? raw.toUpperCase() : "UNKNOWN";
    const c = cities.get(key) || { city: raw ? titleCase(raw) : "Unknown", booked: 0, delivered: 0, returned: 0, inProcess: 0, cancelled: 0, status: {} };
    cities.set(key, c);
    if (bucket === "cancelled") { c.cancelled++; t.cancelled++; continue; } // cancelled parcels are not shipments
    c.booked++; t.booked++;
    if (bucket === "delivered") { c.delivered++; t.delivered++; }
    else if (bucket === "returned") { c.returned++; t.returned++; }
    else {
      c.inProcess++; t.inProcess++;
      const label = r.inLabel || (r.status_code ? (CN_STATUS[r.status_code] || r.status_code) : "In transit / not yet updated");
      c.status[label] = (c.status[label] || 0) + 1;
      inProcessStatus[label] = (inProcessStatus[label] || 0) + 1;
    }
  }

  const rate = (o) => ({
    ...o,
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
    totals: rate(t),
    inProcessStatus,
    cities: [...cities.values()].filter((c) => c.booked || c.cancelled).map(rate).sort((a, b) => b.booked - a.booked || a.city.localeCompare(b.city)),
  };
}
