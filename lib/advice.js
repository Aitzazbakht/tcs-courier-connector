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

// ---- Answering a ticket (this changes what TCS does with a real parcel, so everything is checked first) ----
// TCS action ids: 1 = Re-forward (details 2 edited address, 3 new address, 4 HFC counter, 5 same address), 2 = Return to the shipper (detail 1 = RTS).
export const ANSWERS = {
  same: { actionid: 1, actiondetailid: 5, label: "Re-forward to the same address" },
  edited: { actionid: 1, actiondetailid: 2, label: "Re-forward to an edited address", needsAddress: true },
  new: { actionid: 1, actiondetailid: 3, label: "Re-forward to a new address", needsAddress: true },
  hfc: { actionid: 1, actiondetailid: 4, label: "Hold at the TCS counter (HFC)" },
  rts: { actionid: 2, actiondetailid: 1, label: "Return to the shipper (RTS)" },
};

// Pure: checks the answer and builds the body TCS wants. Throws a plain message when something is missing.
export function buildAdviceBody({ cn, ticket, answer, address = "", phone = "", remarks = "" }) {
  const a = ANSWERS[answer];
  if (!a) throw new Error("Pick one of the answers.");
  const c = String(cn || "").replace(/\D/g, ""), t = Number(ticket);
  if (c.length < 9) throw new Error("The parcel number is missing.");
  if (!Number.isInteger(t) || t <= 0) throw new Error("The ticket number is missing.");
  const addr = String(address || "").trim().replace(/\s+/g, " ");
  if (a.needsAddress && addr.length < 10) throw new Error("Type the full new address (at least 10 characters).");
  let ph = String(phone || "").replace(/[^0-9+]/g, "");
  if (ph && !/^(\+92|0)?3[0-9]{9}$/.test(ph) && !/^[0-9]{10,13}$/.test(ph)) throw new Error("That phone number doesn't look right.");
  return {
    consignmentno: c, ticketno: t, actionid: a.actionid, actiondetailid: a.actiondetailid,
    deliveryaddress: a.needsAddress ? addr.slice(0, 250) : "", revisedphoneno: ph, remarks: String(remarks || "").trim().slice(0, 200),
  };
}

// Sends the answer. Only a ticket that TCS lists as pending right now, for that exact parcel, can be answered, and the caller must confirm.
export async function adviceAnswer(p) {
  if (p.confirm !== true) throw new Error("Confirm to send this answer to TCS.");
  const body = buildAdviceBody(p);
  const pending = await tcs.exploreGet("/ecom/api/shipperadvice/pendingtickets");
  const hit = (pending?.shipperadvicedetails || []).find((t) => Number(t.ticketno) === body.ticketno && num(t.consignmentno) === body.consignmentno);
  if (!hit) throw new Error("TCS does not list this ticket as pending for this parcel any more. Press Refresh from TCS.");
  const res = await tcs.shipperAdviceUpdate(body);
  return { ok: true, sent: { ...body }, answer: ANSWERS[p.answer].label, response: res };
}
