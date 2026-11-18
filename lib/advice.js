// "Shipper advice": parcels TCS cannot deliver and is waiting for our instruction on (a "ticket"). TCS offers two actions:
// Re-forward (with: edited address, new address, HFC counter = hold at the TCS counter, same address) and Return to the shipper (RTS).
// This file reads the pending tickets and matches each one to its Shopify order.
import * as tcs from "./tcs.js";
import { ordersByCn } from "./returns.js";
import { codOf } from "./notify.js";
import { tagId } from "./store.js";
import { stuckDays } from "./inprocess.js";
import { pkDay } from "./daily.js";

const todayPk = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const num = (s) => String(s || "").trim();

// "2026-11-01 07:00 PM" -> "2026-11-01"
export const ticketDay = (s) => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s || "")); return m ? m[1] : ""; };
// Days a ticket has waited for us: up to 1 day normal, 2 to 3 amber, 4 or more red (TCS sends the parcel back or stops trying).
export const adviceBand = (days) => (days >= 4 ? "bad" : days >= 2 ? "warn" : "ok");

export function shapeTicket(t, today = todayPk()) {
  const day = ticketDay(t.deliverydate), days = day ? stuckDays(day, today) : 0;
  return {
    cn: num(t.consignmentno), ticket: t.ticketno, status: num(t.deliverystatus), when: num(t.deliverydate), day, days, band: adviceBand(days),
    remarks: num(t.remarks), cell: num(t.consigneecell), origin: num(t.origin), destination: num(t.destination),
  };
}

export async function adviceList() {
  const warnings = [];
  const [pending, actions] = await Promise.all([
    tcs.exploreGet("/ecom/api/shipperadvice/pendingtickets"),
    tcs.exploreGet("/ecom/api/shipperadvice/getactions"),
  ]);
  const rows = (pending?.shipperadvicedetails || []).map((t) => shapeTicket(t));
  const orders = await ordersByCn(rows.map((r) => r.cn), warnings, Date.now() + 25000);
  for (const r of rows) {
    const hit = orders.get(r.cn);
    if (!hit) continue;
    const o = hit.o, a = o.shippingAddress || {};
    Object.assign(r, {
      id: tagId(hit.st.key, o.id), store: hit.st.key, storeLabel: hit.st.label, order: o.name, customer: a.name || "", phone: a.phone || o.phone || "",
      address: [a.address1, a.address2].map(num).filter(Boolean).join(", "), city: a.city || "", cod: codOf(o),
      products: (o.lineItems?.nodes || []).map((l) => (l.quantity > 1 ? l.quantity + " x " : "") + num(l.title)).join(", "),
    });
  }
  rows.sort((a, b) => b.days - a.days);
  // The two actions and their details, as TCS lists them (the details are fixed: re-forward has four, return has RTS).
  const acts = [];
  for (const a of actions?.actions || []) {
    let details = [];
    try { details = (await tcs.exploreGet("/ecom/api/shipperadvice/getactiondetailsbyactionid", { actionid: String(a.actionid) }))?.actiondetails || []; } catch { /* shown without details */ }
    acts.push({ id: a.actionid, name: a.actiondescription, details: details.map((d) => ({ id: d.actiondetailid, name: d.actiondetaildescription })) });
  }
  return { rows, actions: acts, warnings, pulledAt: new Date().toISOString() };
}
