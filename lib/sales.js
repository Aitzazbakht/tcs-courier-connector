// Daily sales report for the "Sales report" tab. It is the in-app version of the scheduled "Chitral House daily sales
// report": totals, sales by channel, WhatsApp orders, WhatsApp Marketing link orders, Chitral Herbs orders, products,
// every order with its attribution, and ad spend with Shopify-based ROAS.
// Channels come from each order's last visit in Shopify (utm tags, referrer, click ids), so they can differ a little
// from Shopify Analytics' own channel table. Ad spend comes from Windsor.ai (lib/ads.js); platform-reported purchases
// are not part of this tab.
import * as shop from "./shopify.js";
import { withStore } from "./store.js";
import { pkWindow } from "./daily.js";
import { herbsOrders } from "./herbs.js";
import { adSpend, adCampaigns } from "./ads.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const money = (m) => Math.round(Number(m?.shopMoney?.amount) || 0);
const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const pct = (a, b) => (b > 0 ? +((a / b) * 100).toFixed(2) : 0);

const VISIT = `source sourceType referrerUrl landingPage utmParameters { source medium campaign }`;
const FIELDS = `name createdAt cancelledAt test tags sourceName note paymentGatewayNames displayFinancialStatus discountCodes
  totalPriceSet { shopMoney { amount } } subtotalPriceSet { shopMoney { amount } } totalDiscountsSet { shopMoney { amount } }
  lineItems(first: 30) { nodes { title variantTitle quantity originalUnitPriceSet { shopMoney { amount } } } }`;
const Q_FULL = `query S($q: String!, $after: String) { orders(first: 100, after: $after, query: $q, sortKey: CREATED_AT) {
  pageInfo { hasNextPage endCursor } nodes { ${FIELDS} customerJourneySummary { ready lastVisit { ${VISIT} } firstVisit { ${VISIT} } } } } }`;
const Q_PLAIN = `query S($q: String!, $after: String) { orders(first: 100, after: $after, query: $q, sortKey: CREATED_AT) {
  pageInfo { hasNextPage endCursor } nodes { ${FIELDS} } } }`;

// ---------- channel from an order's last visit ----------
export function channelOf(journey) {
  const v = journey && (journey.lastVisit || journey.firstVisit);
  if (!v) return { channel: "Unknown", type: "unknown", utmSource: "", utmMedium: "", utmCampaign: "", referrer: "" };
  const utm = v.utmParameters || {};
  const src = String(utm.source || v.source || "").toLowerCase();
  const medium = String(utm.medium || "").toLowerCase();
  const ref = String(v.referrerUrl || "").toLowerCase();
  const land = String(v.landingPage || "").toLowerCase();
  const hay = src + " " + ref;
  let channel;
  if (/instagram|(^|\W)ig(\W|$)/.test(hay)) channel = "Instagram";
  else if (/facebook|(^|\W)fb(\W|$)|meta|fb\.com|l\.facebook/.test(hay)) channel = "Facebook";
  else if (/tiktok/.test(hay) || /ttclid=/.test(land)) channel = "TikTok";
  else if (/google|gclid=/.test(hay + " " + land)) channel = "Google";
  else if (/youtube|youtu\.be/.test(hay)) channel = "YouTube";
  else if (/whatsapp|wa\.me/.test(hay)) channel = "WhatsApp link";
  else if (!src && !ref) channel = "Direct";
  else if (/^direct$/.test(src)) channel = "Direct";
  else channel = src && src !== "direct" ? src.replace(/^www\./, "").slice(0, 24) : "Other";
  const paidMedium = /paid|cpc|ppc|cpm|cpv|display|ads?(\W|$)/.test(medium) || /gclid=|ttclid=/.test(land) || /paid/.test(String(v.sourceType || "").toLowerCase());
  return { channel, type: paidMedium ? "paid" : "organic", utmSource: utm.source || "", utmMedium: utm.medium || "", utmCampaign: utm.campaign || "", referrer: v.referrerUrl || "" };
}

// ---------- WhatsApp source from tags ----------
const IGNORE_TAG = /^(whatsapp|cod|prepaid|paid|tcs-booked|chitral herbs|fake-order|cod-0|auto-booked)$/i;
export function whatsappSource(tags) {
  const left = (tags || []).map((t) => String(t).trim()).filter((t) => t && !IGNORE_TAG.test(t) && !/^tcs-/i.test(t) && !/^ch-\d+/i.test(t)).map((t) => t.replace(/^wa-/i, ""));
  const norm = (t) => { const l = t.toLowerCase();
    if (/tiktok/.test(l)) return "TikTok"; if (/instagram|^ig$/.test(l)) return "Instagram"; if (/facebook|^fb$|meta/.test(l)) return "Facebook";
    if (/google/.test(l)) return "Google"; if (/youtube/.test(l)) return "YouTube"; if (/website|web/.test(l)) return "Website";
    if (/repeat/.test(l)) return "Repeat customer"; if (/referr/.test(l)) return "Referral"; return "Other"; };
  const all = left.map(norm);
  if (!all.length) return "Unknown";
  return all.find((s) => ["TikTok", "Instagram", "Facebook", "Google"].includes(s)) || all[0];
}
const platformOfWa = (src) => (src === "TikTok" ? "TikTok" : src === "Instagram" || src === "Facebook" ? "Meta" : src === "Google" ? "Google" : "");

// ---------- Chitral Herbs product titles -> Chitral House names ----------
const HERBS_MAP = [
  [/^shilajit 10g$/i, "Buy 10g Pure Shilajit Resin in Pakistan – The Ideal Starter Pack"],
  [/^shilajit 20g$/i, "Buy 20g Pure Shilajit Resin in Pakistan – The Daily Wellness Choice"],
  [/^shilajit 30g$/i, "Buy 30g Pure Shilajit Resin in Pakistan – The Ultimate Value for Long-Term Wellness"],
  [/60g.*(3 months).*10g free/i, "Special Offer – Buy 60g Shilajit & Get 10g Free!"],
  [/gummies 40 count/i, "Buy Shilajit Gummies 40 Count in Pakistan | Original Himalayan Salajeet Gummies | Chitral House"],
];
export const herbsTitle = (t) => { const s = String(t || "").trim(); const m = HERBS_MAP.find(([re]) => re.test(s)); return m ? m[1] : s + " (Chitral Herbs)"; };

// ---------- normalise ----------
const THANKS = /^THANKS10-/i;
export function normHouse(o) {
  const tags = o.tags || [];
  const ch = channelOf(o.customerJourneySummary);
  const gw = (o.paymentGatewayNames || []).join(", ");
  const code = (o.discountCodes || []).find((c) => THANKS.test(c)) || "";
  const isChatTag = tags.some((t) => /^whatsapp$/i.test(String(t).trim()));
  const waUtm = /whatsapp/i.test(ch.utmSource) || /^marketing$/i.test(ch.utmMedium);
  const tagPay = tags.some((t) => /^cod$/i.test(t)) ? "COD" : tags.some((t) => /^prepaid$/i.test(t)) ? "Prepaid" : "";
  return {
    name: o.name, createdAt: o.createdAt, cancelled: !!o.cancelledAt, test: !!o.test, tags,
    isHerbsCopy: tags.some((t) => /^chitral herbs$/i.test(String(t).trim())),
    herbsNo: (tags.map((t) => /^CH-(\d+)$/i.exec(String(t).trim())?.[1]).find(Boolean)) || "",
    isWhatsapp: isChatTag,
    isWM: !!code || waUtm, wmBy: code && waUtm ? "code + UTM" : code ? "code" : "UTM", code,
    waSource: isChatTag ? whatsappSource(tags) : "",
    payment: tagPay || (/cash on delivery|cod|manual/i.test(gw) ? "COD" : "Prepaid"),
    channel: ch.channel, type: ch.type, utmSource: ch.utmSource, utmMedium: ch.utmMedium, utmCampaign: ch.utmCampaign, referrer: ch.referrer,
    total: money(o.totalPriceSet), subtotal: money(o.subtotalPriceSet), discounts: money(o.totalDiscountsSet),
    items: (o.lineItems?.nodes || []).map((l) => ({ title: String(l.title || "").trim(), qty: Number(l.quantity) || 0, price: money(l.originalUnitPriceSet) })),
  };
}

async function listHouse(date, fetcher) {
  const win = pkWindow(date);
  const rows = [];
  let query = Q_FULL, journey = true;
  let after = null;
  for (let i = 0; i < 30; i++) {
    let d;
    try { d = await fetcher(query, { q: `created_at:>='${win.start}' AND created_at:<'${win.end}'`, after }); }
    catch (e) {
      if (journey && i === 0) { journey = false; query = Q_PLAIN; d = await fetcher(query, { q: `created_at:>='${win.start}' AND created_at:<'${win.end}'`, after }); }
      else throw e;
    }
    rows.push(...d.orders.nodes);
    if (!d.orders.pageInfo.hasNextPage) break;
    after = d.orders.pageInfo.endCursor;
  }
  return { rows: rows.map(normHouse), journey };
}

// ---------- the report (pure given its inputs, so it can be tested) ----------
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
export function buildSales({ date, house, journey = true, herbs = [], herbsCopiesSeen = new Set(), prev = null, spend = null, sessions = null, funnel = null, camps = null, warnings = [] }) {
  const live = house.filter((o) => !o.cancelled && !o.test);
  const cancelledHouse = house.filter((o) => o.cancelled).map((o) => o.name);
  const copies = live.filter((o) => o.isHerbsCopy);
  const wa = live.filter((o) => !o.isHerbsCopy && o.isWhatsapp);
  const wm = live.filter((o) => !o.isHerbsCopy && !o.isWhatsapp && o.isWM);
  const web = live.filter((o) => !o.isHerbsCopy && !o.isWhatsapp && !o.isWM);

  const herbsLive = herbs.filter((o) => !o.cancelled && !o.test && !herbsCopiesSeen.has(String(o.order_name).replace(/\D/g, "")));
  const herbsSkipped = herbs.filter((o) => o.cancelled || o.test).map((o) => o.order_name + (o.cancelled ? " (cancelled)" : " (test)"));

  // channel table
  const rowsMap = new Map();
  const bump = (channel, type, o, total, extra = {}) => {
    const k = channel + "|" + type;
    const r = rowsMap.get(k) || { channel, type, orders: 0, sales: 0, ...extra };
    r.orders += 1; r.sales += total; rowsMap.set(k, r);
  };
  for (const o of web) bump(o.channel, o.type, o, o.total);
  for (const o of wa) bump("WhatsApp", o.waSource, o, o.total);
  if (wm.length) for (const o of wm) bump("WhatsApp Marketing", "Discount link", o, o.total);
  for (const o of copies) bump("Chitral Herbs", "Second store", o, o.total);
  for (const o of herbsLive) bump("Chitral Herbs", "Second store", o, o.total);

  const houseTotal = sum(live, (o) => o.total);
  const herbsTotal = sum(herbsLive, (o) => o.total);
  const totalSales = houseTotal + herbsTotal;
  const orders = live.length + herbsLive.length;
  const gross = sum(live, (o) => o.subtotal + o.discounts) + sum(herbsLive, (o) => o.subtotal + o.discounts);
  const sessionByKey = new Map(((funnel && funnel.rows) || []).map((r) => [String(r.channel).toLowerCase() + "|" + String(r.type).toLowerCase(), r]));
  const channels = [...rowsMap.values()].sort((a, b) => b.sales - a.sales).map((r) => { const f = sessionByKey.get(r.channel.toLowerCase() + "|" + String(r.type).toLowerCase()); return { ...r, share: pct(r.sales, totalSales), aov: r.orders ? Math.round(r.sales / r.orders) : 0, sessions: f ? f.sessions : null, conv: f && f.sessions ? +((r.orders / f.sessions) * 100).toFixed(2) : null }; });
  const paidSales = sum(channels.filter((r) => r.type === "paid"), (r) => r.sales);

  // platforms (channel names combined)
  const plat = new Map();
  for (const r of channels) { const p = plat.get(r.channel) || { platform: r.channel, orders: 0, sales: 0 }; p.orders += r.orders; p.sales += r.sales; plat.set(r.channel, p); }
  const platforms = [...plat.values()].sort((a, b) => b.sales - a.sales).map((p) => ({ ...p, share: pct(p.sales, totalSales) }));

  // credited sales per ad platform (web paid + WhatsApp-tagged); Herbs -> Meta Herbs
  const credit = { metaHouse: { orders: 0, sales: 0 }, metaHerbs: { orders: 0, sales: 0 }, tiktok: { orders: 0, sales: 0 }, google: { orders: 0, sales: 0 } };
  const add = (k, o) => { credit[k].orders += 1; credit[k].sales += o.total; };
  const herbsCampIds = new Set(((camps && camps.rows) || []).filter((c) => c.key === "metaHerbs").map((c) => c.id));
  const houseCampIds = new Set(((camps && camps.rows) || []).filter((c) => c.key === "metaHouse").map((c) => c.id));
  const unmatchedMeta = [];
  for (const o of web) if (o.type === "paid") { if (o.channel === "Instagram" || o.channel === "Facebook") { if (herbsCampIds.has(String(o.utmCampaign))) add("metaHerbs", o); else { add("metaHouse", o); if (camps && !houseCampIds.has(String(o.utmCampaign))) unmatchedMeta.push(o.name); } } else if (o.channel === "TikTok") add("tiktok", o); else if (o.channel === "Google") add("google", o); }
  for (const o of wa) { const p = platformOfWa(o.waSource); if (p === "Meta") add("metaHouse", o); else if (p === "TikTok") add("tiktok", o); else if (p === "Google") add("google", o); }
  for (const o of [...copies, ...herbsLive]) add("metaHerbs", o);
  const amounts = (spend && spend.amounts) || {};
  const adRows = [
    ["metaHouse", "Meta – Chitral House"], ["metaHerbs", "Meta – Chitral Herbs"], ["tiktok", "TikTok"], ["google", "Google Ads"],
  ].map(([k, label]) => {
    const sp = k === "tiktok" ? amounts.tiktokHouse : amounts[k];
    const known = typeof sp === "number";
    const c = credit[k];
    const cr = ((camps && camps.rows) || []).filter((x) => x.key === k);
    const pPur = cr.reduce((a, x) => a + x.purchases, 0), pVal = cr.reduce((a, x) => a + x.value, 0);
    const cSpend = cr.reduce((a, x) => a + x.spend, 0);
    return { key: k, label, spend: known ? sp : (cr.length ? cSpend : null), orders: c.orders, sales: c.sales, roas: (known ? sp : cSpend) > 0 ? +(c.sales / (known ? sp : cSpend)).toFixed(2) : null,
      pPurchases: camps ? +pPur.toFixed(2) : null, pValue: camps ? pVal : null, pRoas: camps && (known ? sp : cSpend) > 0 ? +(pVal / (known ? sp : cSpend)).toFixed(2) : null };
  });
  const knownSpend = sum(adRows.filter((r) => r.spend != null), (r) => r.spend) + (typeof amounts.otherMeta === "number" ? amounts.otherMeta : 0);
  const blended = knownSpend > 0 ? +(totalSales / knownSpend).toFixed(2) : null;

  // products
  const prod = new Map();
  const addP = (title, o, qty, price) => { const p = prod.get(title) || { product: title, orders: new Set(), units: 0, gross: 0 }; p.orders.add(o.name); p.units += qty; p.gross += price * qty; prod.set(title, p); };
  for (const o of live) for (const l of o.items) addP(l.title, o, l.qty, l.price);
  for (const o of herbsLive) for (const l of o.items) addP(herbsTitle(l.title), { name: "CH" + o.order_name }, l.quantity, l.price);
  const products = [...prod.values()].map((p) => ({ product: p.product, orders: p.orders.size, units: p.units, gross: p.gross })).sort((a, b) => b.gross - a.gross);
  const prodGross = sum(products, (p) => p.gross);
  for (const p of products) p.share = pct(p.gross, prodGross);

  // products by channel
  const pc = new Map();
  const addPc = (channel, type, title, o, qty, price) => { const k = channel + "|" + type + "|" + title; const p = pc.get(k) || { channel, type, product: title, orders: new Set(), units: 0, gross: 0 }; p.orders.add(o); p.units += qty; p.gross += price * qty; pc.set(k, p); };
  for (const o of live) { const ch = o.isHerbsCopy ? ["Chitral Herbs", "Second store"] : o.isWhatsapp ? ["WhatsApp", o.waSource] : [o.channel, o.type]; for (const l of o.items) addPc(ch[0], ch[1], l.title, o.name, l.qty, l.price); }
  for (const o of herbsLive) for (const l of o.items) addPc("Chitral Herbs", "Second store", herbsTitle(l.title), "CH" + o.order_name, l.quantity, l.price);
  const productsByChannel = [...pc.values()].map((p) => ({ channel: p.channel, type: p.type, product: p.product, orders: p.orders.size, units: p.units, gross: p.gross })).sort((a, b) => b.gross - a.gross);
  // referrer and UTM views (Chitral House orders only)
  const grp = (keyf) => { const m = new Map(); for (const o of live) { const k = keyf(o); const r = m.get(k.join("|")) || { a: k[0], b: k[1], orders: 0, sales: 0 }; r.orders += 1; r.sales += o.total; m.set(k.join("|"), r); } return [...m.values()].sort((x, y) => y.sales - x.sales); };
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u ? String(u).slice(0, 30) : "(none)"; } };
  const referrerView = grp((o) => [o.channel, host(o.referrer)]).map((r) => ({ source: r.a, name: r.b, orders: r.orders, sales: r.sales }));
  const utmView = grp((o) => [o.utmSource || "(none)", o.utmMedium || "(none)"]).map((r) => ({ source: r.a, medium: r.b, orders: r.orders, sales: r.sales }));

  // every order
  const list = [];
  for (const o of live) {
    const kind = o.isHerbsCopy ? "Chitral Herbs" : o.isWhatsapp ? "WhatsApp" : o.isWM ? "WhatsApp Marketing" : o.channel;
    const sub = o.isHerbsCopy ? o.herbsNo : o.isWhatsapp ? o.waSource : o.isWM ? "Discount link" : o.type;
    list.push({ order: o.name, channel: kind, type: sub, utmSource: o.isWhatsapp || o.isHerbsCopy ? "" : o.utmSource, utmMedium: o.isWhatsapp || o.isHerbsCopy ? "" : o.utmMedium, total: o.total, at: o.createdAt,
      missingUtm: !o.isWhatsapp && !o.isHerbsCopy && !o.isWM && o.type === "paid" && !o.utmSource && o.channel !== "Google" });
  }
  for (const o of herbsLive) list.push({ order: "CH " + o.order_name, channel: "Chitral Herbs", type: "chitralherbs.com", utmSource: "", utmMedium: "", total: o.total, at: o.created_at, missingUtm: false });
  list.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  const prevTotal = prev ? prev.total : null;
  return {
    date, journey,
    kpi: {
      totalSales, orders, aov: orders ? Math.round(totalSales / orders) : 0, gross,
      prevSales: prevTotal, prevOrders: prev ? prev.orders : null, change: prevTotal ? +(((totalSales - prevTotal) / prevTotal) * 100).toFixed(2) : null,
      paidSales, paidShare: pct(paidSales, totalSales),
      sessions: sessions ? sessions.sessions : null, conversion: sessions && sessions.sessions ? +(((web.length + wm.length) / sessions.sessions) * 100).toFixed(2) : null,
      webOrders: web.length + wm.length, houseSales: houseTotal,
    },
    mix: {
      whatsapp: { orders: wa.length, sales: sum(wa, (o) => o.total), share: pct(sum(wa, (o) => o.total), totalSales) },
      wm: { orders: wm.length, sales: sum(wm, (o) => o.total), share: pct(sum(wm, (o) => o.total), totalSales), discount: sum(wm, (o) => o.discounts) },
      herbs: { orders: copies.length + herbsLive.length, sales: sum(copies, (o) => o.total) + herbsTotal, share: pct(sum(copies, (o) => o.total) + herbsTotal, totalSales) },
    },
    channels, platforms,
    ads: { rows: adRows, blended, knownSpend, status: spend ? spend.status : null, note: spend ? "" : "Ad spend not loaded" },
    whatsapp: wa.map((o) => ({ order: o.name, source: o.waSource, payment: o.payment, total: o.total, credited: platformOfWa(o.waSource) })),
    wm: wm.map((o) => ({ order: o.name, by: o.wmBy, was: o.channel + " · " + o.type, code: o.code, discount: o.discounts, total: o.total })),
    herbs: [...copies.map((o) => ({ order: "CH #" + o.herbsNo, source: "legacy copy " + o.name, payment: o.payment, total: o.total, items: o.items.map((l) => l.qty + " x " + l.title).join(", ") })),
      ...herbsLive.map((o) => ({ order: "CH " + o.order_name, source: "direct (feed)", payment: o.payment, total: o.total, items: o.items.map((l) => l.quantity + " x " + herbsTitle(l.title)).join(", ") }))],
    products, productsByChannel, referrerView, utmView, orders: list,
    funnel: funnel && funnel.rows ? funnel : null, funnelError: funnel && funnel.error ? funnel.error : "",
    camps: camps ? camps.rows : null, campsStatus: camps ? camps.status : null,
    notes: { unmatchedMeta, cancelled: cancelledHouse, herbsSkipped, missingUtm: list.filter((x) => x.missingUtm).map((x) => x.order) },
    warnings,
  };
}

// ShopifyQL sessions funnel by channel (needs the read_reports permission; the error is shown when it is missing)
async function sessionsFunnel(date, fetcher) {
  try {
    const d = await fetcher(`query { shopifyqlQuery(query: "FROM sessions SHOW sessions, online_store_visitors, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout, conversion_rate GROUP BY referring_channel, traffic_type SINCE ${date} UNTIL ${date} ORDER BY sessions DESC") { tableData { rows } parseErrors } }`, {});
    const q = d.shopifyqlQuery;
    if (q?.parseErrors?.length) return { error: String(q.parseErrors[0]).slice(0, 200) };
    const rows = (q?.tableData?.rows || []).map((r) => ({ channel: String(r.referring_channel || "(blank)"), type: String(r.traffic_type || ""), sessions: Number(r.sessions) || 0, visitors: Number(r.online_store_visitors) || 0, atc: Number(r.sessions_with_cart_additions) || 0, checkout: Number(r.sessions_that_reached_checkout) || 0, completed: Number(r.sessions_that_completed_checkout) || 0 }));
    return { rows, sessions: rows.reduce((a, r) => a + r.sessions, 0) };
  } catch (e) { return { error: e.message.slice(0, 220) }; }
}

export async function salesReport(date, { fetcher = (q, v) => shop.gql(q, v), herbsFetcher, ads = adSpend, campaigns = adCampaigns } = {}) {
  if (!ISO.test(date || "")) throw new Error("Pick a valid date.");
  const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  if (date > today) throw new Error("That date is in the future.");
  const warnings = [];
  const prevDate = addDays(date, -1);
  const hf = herbsFetcher ? (d) => herbsOrders(d, herbsFetcher) : (d) => herbsOrders(d);
  const settle = async (p, what) => { try { return await p; } catch (e) { warnings.push(what + ": " + e.message); return null; } };

  const [h, hPrev, herbsToday, herbsPrev, spend, camps, sess, copiesSeen] = await Promise.all([
    withStore("house", () => listHouse(date, fetcher)),
    settle(withStore("house", () => listHouse(prevDate, fetcher)), "Previous day (Chitral House)"),
    settle(hf(date), "Chitral Herbs orders for this date"),
    settle(hf(prevDate), "Chitral Herbs orders for the previous day"),
    settle(process.env.WINDSOR_API_KEY ? ads(date) : Promise.resolve(null), "Ad spend"),
    settle(process.env.WINDSOR_API_KEY ? campaigns(date) : Promise.resolve(null), "Ad campaigns"),
    withStore("house", () => sessionsFunnel(date, fetcher)),
    settle(withStore("house", async () => {
      const win = pkWindow(addDays(date, -3));
      const d = await fetcher(`query { orders(first: 100, query: "tag:'Chitral Herbs' AND created_at:>='${win.start}'") { nodes { tags } } }`, {});
      return new Set(d.orders.nodes.flatMap((n) => n.tags).map((t) => /^CH-(\d+)$/i.exec(t)?.[1]).filter(Boolean));
    }), "Chitral Herbs legacy copies"),
  ]);
  if (!h.journey) warnings.push("Channels are unknown: Shopify did not return the visit details (customer journey) for these orders.");
  if (!process.env.WINDSOR_API_KEY) warnings.push("Ad spend is blank: add WINDSOR_API_KEY in Vercel.");
  if (!herbsToday) warnings.push("Chitral Herbs direct orders are not available for this date and are left out of the totals.");

  const seen = copiesSeen || new Set();
  const prevLive = hPrev ? hPrev.rows.filter((o) => !o.cancelled && !o.test) : [];
  const prevHerbs = herbsPrev ? herbsPrev.orders.filter((o) => !o.cancelled && !o.test && !seen.has(String(o.order_name).replace(/\D/g, ""))) : [];
  const prev = hPrev && (herbsPrev || date < "2026-10-10") ? { total: sum(prevLive, (o) => o.total) + sum(prevHerbs, (o) => o.total), orders: prevLive.length + prevHerbs.length } : null;
  const out = buildSales({ date, house: h.rows, journey: h.journey, herbs: herbsToday ? herbsToday.orders : [], herbsCopiesSeen: seen, prev, spend, sessions: sess && sess.rows ? sess : null, funnel: sess, camps, warnings });
  out.pulledAt = new Date(Date.now() + 5 * 3600e3).toISOString().replace(/\.\d+Z$/, "+05:00");
  out.herbsLatest = herbsToday ? herbsToday.latest_order_at : null;
  return out;
}
