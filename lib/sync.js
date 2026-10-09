// Shopify -> TCS order sync.
import * as tcs from "./tcs.js";
import * as shop from "./shopify.js";
import { tcsCities, matchCity } from "./cities.js";

export const TAG_BOOKED = "tcs-booked";
export const TAG_LOCK = "tcs-processing";
export const TAG_FAILED = "tcs-failed";
const PENDING_SEARCH = `fulfillment_status:unfulfilled status:open -tag:${TAG_BOOKED}`;

export function normalizePhone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(4);
  if (d.startsWith("92") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith("3")) d = "0" + d;
  return /^03\d{9}$/.test(d) ? d : null;
}

function shortTitle(title) {
  const parts = String(title).split(/\s[–—-]\s|\s\|\s/);
  let t = parts.find((p) => /\d|shilajit|gumm|honey/i.test(p)) || parts[0];
  t = t.replace(/^buy\s+/i, "").replace(/\s+in pakistan.*$/i, "").replace(/[^\x20-\x7E]/g, "").trim();
  return t || "Shilajit";
}

export function productSummary(order) {
  return (order.lineItems?.nodes || [])
    .map((li) => `${shortTitle(li.title)}${li.variantTitle ? " " + li.variantTitle : ""} x${li.quantity}`)
    .join(", ")
    .slice(0, 100);
}

export function toShipment(order, cities, overrideCityCode, overrideCityName) {
  const a = order.shippingAddress || {};
  const issues = [];
  const mobile = normalizePhone(a.phone) || normalizePhone(order.phone);
  if (!mobile) issues.push("No valid Pakistani mobile number");
  const address = String(a.address1 || "").trim();
  let address2 = String(a.address2 || "").trim();
  if (address2.length < 3 || address.toLowerCase().includes(address2.toLowerCase())) address2 = "";
  if (address.length < 3) issues.push("Address missing or too short");

  let city = null;
  if (overrideCityCode) {
    const c = cities.find((x) => x.citycode === overrideCityCode && (!overrideCityName || x.cityname === overrideCityName))
      || (!overrideCityName && cities.find((x) => x.citycode === overrideCityCode));
    if (c) city = { code: c.citycode, name: c.cityname, how: "manual" };
  }
  if (!city) city = matchCity(cities, a.city, `${address} ${address2}`);
  if (!city) issues.push(`City "${a.city || ""}" not recognised — pick the TCS city`);

  const cod = Math.max(0, Math.round(Number(order.totalOutstandingSet?.shopMoney?.amount ?? order.totalPriceSet?.shopMoney?.amount ?? 0)));
  const name = a.name || [a.firstName, a.lastName].filter(Boolean).join(" ") || "Customer";

  return {
    issues,
    city_input: a.city || "",
    city_match: city?.how || null,
    booking: {
      full_name: name,
      mobile,
      address: address + (address2 ? ", " + address2 : ""),
      city_code: city?.code,
      city_name: city?.name,
      cod_amount: cod,
      order_ref: order.name.replace(/^#/, ""),
      contents: productSummary(order),
      pieces: 1,
      weight_kg: 0.5,
      email: order.email || "",
    },
  };
}

const cnFromTags = (tags) => (tags || []).map((t) => /^TCS-(\d{6,})$/i.exec(t)?.[1]).find(Boolean) || null;

export async function listPending() {
  const [orders, cities] = await Promise.all([shop.listOrders(PENDING_SEARCH, 250), tcsCities()]);
  return orders.map((o) => {
    const s = toShipment(o, cities);
    return {
      id: o.id,
      name: o.name,
      createdAt: o.createdAt,
      customer: s.booking.full_name,
      phone: s.booking.mobile || o.shippingAddress?.phone || o.phone || "",
      address: s.booking.address,
      city_input: s.city_input,
      city_code: s.booking.city_code || "",
      city_name: s.booking.city_name || "",
      city_match: s.city_match,
      cod: s.booking.cod_amount,
      products: s.booking.contents,
      payment: (o.paymentGatewayNames || []).join(", "),
      processing: (o.tags || []).includes(TAG_LOCK),
      failed: (o.tags || []).includes(TAG_FAILED),
      issues: s.issues,
    };
  });
}

export async function listRecentBooked(n = 30) {
  const orders = await shop.listOrders(`tag:${TAG_BOOKED}`, n);
  return orders.map((o) => ({ id: o.id, name: o.name, createdAt: o.createdAt, customer: o.shippingAddress?.name || "", cn: cnFromTags(o.tags), fulfillment: o.displayFulfillmentStatus }));
}

export async function cityOptions() {
  return (await tcsCities()).map((c) => ({ code: c.citycode, name: c.cityname })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function isAutoOn() {
  try { return (await shop.getSetting("auto_book")).value === "true"; }
  catch { return process.env.AUTO_BOOK === "true"; }
}

// Book one Shopify order on TCS, tag it, and fulfill it with tracking.
export async function pushOrder(id, { cityCode, cityName, force = false, notifyCustomer = true } = {}) {
  const order = await shop.getOrder(id);
  if (!order) return { id, ok: false, error: "Order not found" };
  const tags = order.tags || [];
  const existing = cnFromTags(tags);
  if (tags.includes(TAG_BOOKED) || existing) return { id, name: order.name, ok: true, skipped: "Already booked", cn: existing };
  if (order.cancelledAt) return { id, name: order.name, ok: false, error: "Order is cancelled" };
  if (order.displayFulfillmentStatus === "FULFILLED") return { id, name: order.name, ok: false, error: "Order already fulfilled" };
  if (tags.includes(TAG_LOCK) && !force) return { id, name: order.name, ok: false, error: "Booking already in progress for this order" };

  const s = toShipment(order, await tcsCities(), cityCode, cityName);
  if (s.issues.length) return { id, name: order.name, ok: false, error: s.issues.join("; ") };

  await shop.addTags(id, [TAG_LOCK]);
  let res;
  try {
    res = await tcs.createBooking(s.booking);
  } catch (e) {
    await shop.removeTags(id, [TAG_LOCK]).catch(() => {});
    await shop.addTags(id, [TAG_FAILED]).catch(() => {});
    return { id, name: order.name, ok: false, error: e.message };
  }
  const cn = res?.consignmentNo;
  if (!cn) {
    await shop.removeTags(id, [TAG_LOCK]).catch(() => {});
    await shop.addTags(id, [TAG_FAILED]).catch(() => {});
    return { id, name: order.name, ok: false, error: `TCS: ${res?.message || JSON.stringify(res).slice(0, 200)}` };
  }

  // Record the CN on the order first, so nothing can book it twice.
  await shop.addTags(id, [TAG_BOOKED, `TCS-${cn}`]);
  await shop.removeTags(id, [TAG_LOCK, TAG_FAILED]).catch(() => {});

  let warning;
  try { await shop.fulfillWithTracking(order, cn, notifyCustomer); }
  catch (e) { warning = `Booked, but marking fulfilled failed: ${e.message}`; }
  return { id, name: order.name, ok: true, cn, city: s.booking.city_name, cod: s.booking.cod_amount, warning };
}
