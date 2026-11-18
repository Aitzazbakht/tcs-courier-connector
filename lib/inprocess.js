// "Delivery problems to resolve": every parcel booked on TCS that is still in process (not delivered, not returned),
// across both stores, with its latest TCS status. Tracking results are cached for 15 minutes (see trackAll).
import * as shop from "./shopify.js";
import { perStore } from "./sync.js";
import { trackAll, pkDay, todayPk } from "./daily.js";
import { stuckLabel } from "./report.js";
import { TAG, codOf, eventTime } from "./notify.js";
import { tagId } from "./store.js";

const DAYS = 60;

// Days a parcel has been with TCS: from the day it was booked (the courier picks it up that day or the next) to today.
export const stuckDays = (bookedDay, today) => (bookedDay && today ? Math.max(0, Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(bookedDay + "T00:00:00Z")) / 86400000)) : 0);
// 0-3 days is normal (green), 4-5 amber, 6-9 red (check first), 10 or more: the whole row is red.
export const stuckBand = (days) => (days >= 10 ? "crit" : days >= 6 ? "bad" : days >= 4 ? "warn" : "ok");
// The day (Pakistan time) of TCS's latest tracking event, e.g. "Thursday Nov 12, 2026 14:30" -> "2026-11-12"; "" when TCS gave no date.
export const whenDay = (when) => { const t = when ? eventTime(when) : null; return t === null ? "" : new Date(t + 5 * 3600e3).toISOString().slice(0, 10); };
const addressOf = (a) => [a?.address1, a?.address2].map((x) => String(x || "").trim()).filter(Boolean).join(", ");
const productsOf = (o) => (o.lineItems?.nodes || []).map((l) => (l.quantity > 1 ? l.quantity + " x " : "") + String(l.title || "").trim() + (l.variantTitle && l.variantTitle !== "Default Title" ? " (" + l.variantTitle + ")" : "")).join(", ");
const bookedDayOf = (o, tr) => tr.booked || ((o.fulfillments || []).map((f) => f.createdAt).filter(Boolean).sort()[0] ? pkDay([...(o.fulfillments || [])].map((f) => f.createdAt).filter(Boolean).sort()[0]) : "") || (o.createdAt ? pkDay(o.createdAt) : "");

export async function inProcess({ refresh = false } = {}) {
  const deadline = Date.now() + 48000;
  const since = new Date(Date.now() - DAYS * 86400e3).toISOString().slice(0, 10);
  const warnings = [];
  const per = await perStore(async (st) => {
    const list = await shop.listOrders(`tag:tcs-booked -tag:${TAG.DONE} created_at:>=${since}`, 600);
    return list.map((o) => ({ o }));
  });
  for (const e of per.errors) warnings.push(`${e.store}: ${e.error}`);
  const orders = per.rows.map((r) => ({ o: r.o, st: { key: r.store, label: r.storeLabel } }));
  const rows = [];
  for (const { o, st } of orders) {
    if (o.cancelledAt) continue;
    const cn = (o.tags || []).map((t) => /^TCS-(\d{6,})$/i.exec(t)?.[1]).find(Boolean);
    if (cn) rows.push({ o, st, cn });
  }
  const t = await trackAll([...new Set(rows.map((r) => r.cn))], refresh, deadline);
  let unchecked = 0;
  const out = [], today = todayPk();
  for (const { o, st, cn } of rows) {
    const tr = t.map.get(cn);
    if (!tr || tr.failed) { unchecked++; continue; }
    if (!tr.valid || tr.group !== "open") continue; // invalid numbers, delivered and returned parcels are not "in process"
    const x = stuckLabel(tr.code, tr.state);
    const tags = o.tags || [];
    out.push({
      id: tagId(st.key, o.id), store: st.key, storeLabel: st.label, name: o.name, createdAt: o.createdAt,
      customer: o.shippingAddress?.name || "", phone: o.shippingAddress?.phone || o.phone || "", city: o.shippingAddress?.city || "",
      cn, cod: codOf(o), address: addressOf(o.shippingAddress), products: productsOf(o),
      lastDay: whenDay(tr.when), lastDays: tr.when && whenDay(tr.when) ? stuckDays(whenDay(tr.when), today) : null,
      bookedDay: bookedDayOf(o, tr), days: stuckDays(bookedDayOf(o, tr), today), band: stuckBand(stuckDays(bookedDayOf(o, tr), today)),
      status: x.label, issue: x.issue, latest: tr.state, when: tr.when, booked: tr.booked, events: tr.events,
      handled: tags.includes(TAG.PROBLEM_HANDLED),
      reply: tags.includes(TAG.RETRY) ? "retry" : tags.includes(TAG.CANCELLED) ? "cancel" : tags.some((g) => g.startsWith("wa-issue-")) ? "asked" : "",
    });
  }
  if (unchecked) warnings.push(`${unchecked} parcel(s) couldn't be checked with TCS yet. Press Refresh to check them again.`);
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { rows: out, warnings, windowDays: DAYS, checked: t.fetched, reused: t.hits };
}
