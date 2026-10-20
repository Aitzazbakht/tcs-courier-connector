// "Delivery problems to resolve": every parcel booked on TCS that is still in process (not delivered, not returned),
// across both stores, with its latest TCS status. Tracking results are cached for 15 minutes (see trackAll).
import * as shop from "./shopify.js";
import { perStore } from "./sync.js";
import { trackAll } from "./daily.js";
import { stuckLabel } from "./report.js";
import { TAG, codOf } from "./notify.js";
import { tagId } from "./store.js";

const DAYS = 60;

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
  const out = [];
  for (const { o, st, cn } of rows) {
    const tr = t.map.get(cn);
    if (!tr || tr.failed) { unchecked++; continue; }
    if (!tr.valid || tr.group !== "open") continue; // invalid numbers, delivered and returned parcels are not "in process"
    const x = stuckLabel(tr.code, tr.state);
    const tags = o.tags || [];
    out.push({
      id: tagId(st.key, o.id), store: st.key, storeLabel: st.label, name: o.name, createdAt: o.createdAt,
      customer: o.shippingAddress?.name || "", phone: o.shippingAddress?.phone || o.phone || "", city: o.shippingAddress?.city || "",
      cn, cod: codOf(o),
      status: x.label, issue: x.issue, latest: tr.state, when: tr.when, booked: tr.booked, events: tr.events,
      handled: tags.includes(TAG.PROBLEM_HANDLED),
      reply: tags.includes(TAG.RETRY) ? "retry" : tags.includes(TAG.CANCELLED) ? "cancel" : tags.some((g) => g.startsWith("wa-issue-")) ? "asked" : "",
    });
  }
  if (unchecked) warnings.push(`${unchecked} parcel(s) couldn't be checked with TCS yet. Press Refresh to check them again.`);
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { rows: out, warnings, windowDays: DAYS, checked: t.fetched, reused: t.hits };
}
