// "Daily Sales & Profit Report" for the Setup tab.
// It is built on the same data as the Total delivery report: every order placed on one Pakistan day (both Shopify
// stores) is followed to its outcome (delivered by TCS, delivered by our own ISB/RWP rider, returned, still open, or
// not traced), wherever and whenever it was booked. Each order is then costed per product and turned into a profit
// and loss, so the delivery counts here always equal the Total delivery report for the same day.
import * as shop from "./shopify.js";
import { perStore } from "./sync.js";
import { pkWindow, dailyReport } from "./daily.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const DELIVERY_TCS = 280; // per TCS parcel
export const DELIVERY_RIDER = 260; // per order carried by our own ISB/RWP rider
export const USD_MARKUP = 8; // we buy USD for ads at the market rate + 8 PKR
export const DEFAULT_USD_RATE = 276;
export const FEE_PCT = 4;

export const PRODUCTS = {
  r10: { label: "10g Resin", cost: 300, units: 1 },
  r20: { label: "20g Resin", cost: 560, units: 1 },
  r30: { label: "30g Resin", cost: 700, units: 1 },
  r60: { label: "60g Resin", cost: 1130, units: 1 },
  r60f: { label: "60g + 10g free", cost: 1430, units: 2 },
  drops: { label: "Drops 30ml", cost: 650, units: 1 },
  r60d: { label: "60g Resin + 30ml Drops bundle", cost: 1780, units: 2 }, // 1,130 + 650
  g40: { label: "Gummies 40", cost: 440, units: 1 },
  g60: { label: "Gummies 60", cost: 620, units: 1 },
  h15: { label: "Honey 15 sachets", cost: 460, units: 1 },
  h30: { label: "Honey 30 sachets", cost: 820, units: 1 },
  combo: { label: "3-in-1 Combo / Defence Power Bundle", cost: 1780, units: 1 },
  loose: { label: "Loose sachets", cost: 31, units: 1 }, // per sachet
  other: { label: "Other / not in cost list", cost: 0, units: 1 },
};

export const AD_ACCOUNTS = [
  ["metaHouse", "Meta: Chitral House (Myadaccount)"],
  ["metaHerbs", "Meta: Chitral Herbs (Not use)"],
  ["tiktokHouse", "TikTok: Chitral House SMC PVT LTD1119"],
  ["google", "Google Ads (790-385-1046)"],
  ["otherMeta", "Other Chitral Meta accounts (expected 0)"],
];

const SOURCE_LABEL = { house: "Chitral House", whatsapp: "WhatsApp", herbs: "Chitral Herbs" };
const SOURCE_ORDER = ["house", "whatsapp", "herbs"];

const clean = (s) => String(s || "").trim();
const money = (n) => Math.round(Number(n) || 0);
const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const digits = (s) => String(s || "").replace(/\D/g, "");

// Map a Shopify line item to a cost-list product. `mult` multiplies the quantity (loose sachets are sold as "6 pcs").
export function classify(title, variant) {
  const v = clean(variant);
  const t = (String(title || "") + " " + (v && v !== "Default Title" ? v : "")).toLowerCase();
  if (/defen[cs]e power|3\s*-?\s*in\s*-?\s*1|combo/.test(t)) return { key: "combo", mult: 1 };
  if (/\b60\s*g\b/.test(t) && /free/.test(t)) return { key: "r60f", mult: 1 };
  if (/\b60\s*g\b/.test(t) && /drops|\b30\s*ml\b/.test(t)) return { key: "r60d", mult: 1 };
  if (/honey|sachet/.test(t)) {
    const pcs = /\b(\d+)\s*(pcs|pc|pieces)\b/.exec(t);
    if (pcs) return { key: "loose", mult: Number(pcs[1]) };
    if (/\b30\b/.test(t)) return { key: "h30", mult: 1 };
    if (/\b15\b/.test(t)) return { key: "h15", mult: 1 };
    return { key: "other", mult: 1 };
  }
  if (/gumm/.test(t)) {
    if (/\b60\b/.test(t)) return { key: "g60", mult: 1 };
    if (/\b40\b/.test(t)) return { key: "g40", mult: 1 };
    return { key: "other", mult: 1 };
  }
  if (/drops|\b30\s*ml\b/.test(t)) return { key: "drops", mult: 1 };
  const w = /\b(10|20|30|60)\s*g\b/.exec(t);
  if (w) return { key: "r" + w[1], mult: 1 };
  return { key: "other", mult: 1 };
}

// ---------- Shopify ----------
const FIELDS = `name createdAt sourceName tags note cancelledAt phone paymentGatewayNames
  totalPriceSet { shopMoney { amount } }
  shippingAddress { name phone city }
  fulfillments(first: 5) { trackingInfo { number } }
  lineItems(first: 30) { nodes { title variantTitle quantity originalUnitPriceSet { shopMoney { amount } } } }`;

async function listDay(startIso, endIso) {
  const out = [];
  let after = null;
  for (let i = 0; i < 40; i++) {
    const d = await shop.gql(
      `query P($q: String!, $after: String) { orders(first: 100, after: $after, query: $q, sortKey: CREATED_AT) {
        pageInfo { hasNextPage endCursor } nodes { ${FIELDS} } } }`,
      { q: `created_at:>='${startIso}' AND created_at:<'${endIso}'`, after }
    );
    out.push(...d.orders.nodes);
    if (!d.orders.pageInfo.hasNextPage) break;
    after = d.orders.pageInfo.endCursor;
  }
  return out;
}

export function normOrder(o) {
  const tags = o.tags || [];
  const cn = tags.map((t) => /^TCS-(\d{6,})$/i.exec(t)?.[1]).find(Boolean)
    || (o.fulfillments || []).flatMap((f) => f.trackingInfo || []).map((t) => (/^\d{6,}$/.test(clean(t.number)) ? clean(t.number) : null)).find(Boolean) || null;
  const lines = (o.lineItems?.nodes || []).map((li) => {
    const c = classify(li.title, li.variantTitle);
    const p = PRODUCTS[c.key];
    const qty = Number(li.quantity) || 0;
    return {
      key: c.key, label: p.label, title: clean(li.title), qty: qty * c.mult,
      units: p.units * qty * c.mult, cost: p.cost * qty * c.mult,
      list: money(li.originalUnitPriceSet?.shopMoney?.amount) * qty,
    };
  });
  const total = money(o.totalPriceSet?.shopMoney?.amount);
  const listTotal = lines.reduce((s, l) => s + l.list, 0);
  const chat = o.store === "house" && shop.isChatOrder(o);
  return {
    name: o.name, num: digits(o.name), createdAt: o.createdAt, store: o.store, tags, cn,
    source: o.store === "herbs" ? "herbs" : chat ? "whatsapp" : "house",
    cancelled: !!o.cancelledAt || tags.some((t) => /^fake-order$/i.test(t)),
    cancelReason: o.cancelledAt ? "cancelled" : tags.some((t) => /^fake-order$/i.test(t)) ? "fake order" : "",
    customer: clean(o.shippingAddress?.name), city: clean(o.shippingAddress?.city),
    phone10: last10(o.shippingAddress?.phone || o.phone),
    total, listTotal, lines,
    prepaidTag: tags.some((t) => /^COD-0$/i.test(t)),
  };
}

// ---------- Maths (pure, easy to test) ----------
// Sales of an order: the order total; a free (zero) order counts at list price.
function orderSales(o) {
  let sales = o.total, flag = "";
  if (o.total <= 0) {
    if (o.listTotal > 0) { sales = o.listTotal; flag = `Zero-amount order, counted at list price Rs ${o.listTotal}`; }
    else flag = "No amount on the order, counted as 0";
  } else if (o.prepaidTag) flag = `Prepaid (COD 0), counted at the order total Rs ${o.total}`;
  return { sales, flag };
}

const productText = (o) => o.lines.map((l) => (l.qty > 1 ? l.qty + " x " : "") + l.label).join(", ") || "no items";
// delivery-report bucket -> group used here
const GROUP = { deliveredTcs: "delivered", deliveredRider: "delivered", failed: "notDelivered", open: "inProcess", unaccounted: "untraced" };
const keyOf = (store, name) => store + "|" + digits(name);

// orders: normalised orders of the day (cancelled ones included, they are split off here)
// outcomes: Map(store|number -> { kind, bucket, state }) from the Total delivery report
export function buildReport({ date, dateTo = date, orders: all, outcomes, ref = null, ads = {}, usdRate = DEFAULT_USD_RATE, warnings = [] }) {
  const excluded = all.filter((o) => o.cancelled);
  const orders = all.filter((o) => !o.cancelled);
  for (const o of orders) {
    const oc = outcomes.get(keyOf(o.store, o.name)) || { kind: "unaccounted", bucket: "unaccounted", state: "Not in the delivery report" };
    o.kind = oc.kind; o.g = GROUP[oc.bucket] || "untraced"; o.state = oc.state || "";
  }

  // Same customer twice (e.g. a manual WhatsApp order and the website order): count once. Only an order that could not be traced is ever dropped.
  const baseSales = (o) => (o.total > 0 ? o.total : o.listTotal);
  const groups = new Map();
  const live = [];
  for (const o of orders) {
    if (!o.phone10) { live.push(o); continue; }
    const k = o.store + "|" + o.phone10 + "|" + baseSales(o);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  }
  const duplicates = [];
  for (const g of groups.values()) {
    g.sort((a, b) => (Number(b.g !== "untraced") - Number(a.g !== "untraced")) || (Number(!!b.cn) - Number(!!a.cn)) || a.createdAt.localeCompare(b.createdAt));
    live.push(g[0]);
    for (const o of g.slice(1)) {
      if (o.g !== "untraced") live.push(o);
      else duplicates.push({ order: o.name, kept: g[0].name, customer: o.customer, sales: baseSales(o) });
    }
  }
  live.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const flagged = [];
  for (const o of live) {
    const { sales, flag } = orderSales(o);
    o.sales = sales;
    o.cost = o.lines.reduce((s, l) => s + l.cost, 0);
    o.units = o.lines.reduce((s, l) => s + l.units, 0);
    if (flag) flagged.push({ order: o.name, customer: o.customer, note: flag });
  }

  // Booked side
  const bookedSales = live.reduce((s, o) => s + o.sales, 0);
  const bySource = new Map();
  const bump = (m, key, f) => { if (!m.has(key)) m.set(key, f()); return m.get(key); };
  for (const o of live) {
    const r = bump(bySource, o.source, () => ({ key: o.source, label: SOURCE_LABEL[o.source] || o.source, orders: 0, units: 0, sales: 0, cost: 0 }));
    r.orders++; r.units += o.units; r.sales += o.sales; r.cost += o.cost;
  }
  const sources = SOURCE_ORDER.filter((k) => bySource.has(k)).map((k) => bySource.get(k));
  const sourcesTotal = sources.reduce((t, r) => ({ orders: t.orders + r.orders, units: t.units + r.units, sales: t.sales + r.sales, cost: t.cost + r.cost }), { orders: 0, units: 0, sales: 0, cost: 0 });

  // Product-wise sales: an order's sales are shared between its lines by list price, so the table adds up to booked sales
  const byProduct = new Map();
  for (const o of live) {
    const seen = new Set();
    const basis = o.lines.reduce((s, l) => s + l.list, 0) || o.lines.reduce((s, l) => s + l.units, 0) || 1;
    for (const l of o.lines) {
      const r = bump(byProduct, l.key, () => ({ key: l.key, label: l.label, orders: 0, units: 0, sales: 0, cost: 0 }));
      if (!seen.has(l.key)) { r.orders++; seen.add(l.key); }
      r.units += l.units; r.cost += l.cost;
      r.sales += o.sales * ((o.lines.reduce((s, x) => s + x.list, 0) ? l.list : l.units) / basis);
    }
  }
  const products = [...byProduct.values()].sort((a, b) => b.sales - a.sales)
    .map((r) => ({ ...r, sales: Math.round(r.sales), share: bookedSales ? +((100 * r.sales) / bookedSales).toFixed(1) : 0 }));

  const feeRate = FEE_PCT / 100;
  const sum = (rows, f) => rows.reduce((s, r) => s + f(r), 0);
  const delivered = live.filter((o) => o.g === "delivered");
  const inProcess = live.filter((o) => o.g === "inProcess");
  const notDelivered = live.filter((o) => o.g === "notDelivered");
  const untraced = live.filter((o) => o.g === "untraced");
  const shipped = live.length - untraced.length; // same base as the delivery ratio in the Total delivery report
  const tcsParcels = live.filter((o) => o.kind === "tcs").length;
  const riderOrders = live.filter((o) => o.kind === "rider").length;
  const deliveredSales = sum(delivered, (o) => o.sales);
  const productCost = sum(delivered, (o) => o.cost);
  const deliveryTcs = tcsParcels * DELIVERY_TCS, deliveryRider = riderOrders * DELIVERY_RIDER;
  const delivery = deliveryTcs + deliveryRider;
  const adRows = AD_ACCOUNTS.map(([k, label]) => ({ key: k, label, amount: Math.max(0, money(ads?.[k])) }));
  const adSpend = sum(adRows, (r) => r.amount);
  // The 4% is only taken on TCS orders; our own rider's orders carry no fee.
  const feeOf = (o) => (o.kind === "rider" ? 0 : o.sales * feeRate);
  const feeBase = sum(delivered.filter((o) => o.kind !== "rider"), (o) => o.sales);
  const fee = Math.round(feeBase * feeRate);
  const rate = Number(usdRate) > 0 ? Number(usdRate) : DEFAULT_USD_RATE;
  const usdPkr = Math.round((adSpend / rate) * USD_MARKUP);
  const net = deliveredSales - productCost - delivery - adSpend - usdPkr - fee;
  const extra = (rows) => Math.round(sum(rows, (o) => o.sales - feeOf(o) - o.cost));
  const inExtra = extra(inProcess), ndExtra = extra(notDelivered);

  const tcsBySource = new Map();
  for (const o of live) {
    if (o.g === "untraced") continue;
    const s = bump(tcsBySource, o.source, () => ({ key: o.source, label: SOURCE_LABEL[o.source] || o.source, shipped: 0, delivered: 0, inProcess: 0, notDelivered: 0, deliveredSales: 0 }));
    s.shipped++; s[o.g]++; if (o.g === "delivered") s.deliveredSales += o.sales;
  }
  const pctOf = (d, s) => (s ? +((100 * d) / s).toFixed(1) : null);
  const tcsRows = SOURCE_ORDER.filter((k) => tcsBySource.has(k)).map((k) => tcsBySource.get(k)).map((r) => ({ ...r, rate: pctOf(r.delivered, r.shipped) }));
  const tcsTotal = { shipped, delivered: delivered.length, inProcess: inProcess.length, notDelivered: notDelivered.length, deliveredSales, rate: pctOf(delivered.length, shipped) };

  const listOf = (rows) => rows.map((o) => ({ customer: o.customer, product: productText(o), cod: o.sales, sales: o.sales, status: o.state, order: o.name }));

  // The counts must equal the Total delivery report for the same day
  if (ref && (ref.delivered !== delivered.length || ref.counted !== shipped))
    warnings.push(`Counts differ from the Total delivery report (it shows ${ref.delivered} delivered of ${ref.counted}; here ${delivered.length} of ${shipped}). Press Refresh TCS status and build again.`);

  const unmapped = [];
  for (const o of live) for (const l of o.lines) if (l.key === "other") unmapped.push({ order: o.name, title: l.title });
  const byPhone = new Map();
  for (const o of live) if (o.phone10) { if (!byPhone.has(o.phone10)) byPhone.set(o.phone10, []); byPhone.get(o.phone10).push(o); }
  const repeat = [...byPhone.values()].filter((g) => g.length > 1).map((g) => ({ customer: g[0].customer, orders: g.map((o) => o.name) }));
  if (!live.length) warnings.push("No orders were placed on this date.");

  return {
    date, dateTo, generatedAt: new Date().toISOString(), warnings,
    kpi: { orders: live.length, bookedSales, shipped, delivered: delivered.length, deliveredSales, net },
    sources, sourcesTotal, products,
    ads: { rows: adRows, total: adSpend },
    pnl: {
      deliveredSales, productCost, shipped, parcels: tcsParcels, tcsPer: DELIVERY_TCS, riderOrders, riderPer: DELIVERY_RIDER, deliveryTcs, deliveryRider, delivery, adSpend,
      usdRate: rate, usdMarkup: USD_MARKUP, usdPkr, feePct: FEE_PCT, fee, feeBase, net,
      marginPct: deliveredSales ? +((100 * net) / deliveredSales).toFixed(1) : null,
      inProcessCount: inProcess.length, inProcessExtra: inExtra, profitIfInProcess: net + inExtra,
      notDeliveredCount: notDelivered.length, notDeliveredExtra: ndExtra, profitAllDelivered: net + inExtra + ndExtra,
    },
    tcs: { rows: tcsRows, total: tcsTotal },
    delivery: { tcs: delivered.filter((o) => o.kind === "tcs").length, rider: delivered.filter((o) => o.kind === "rider").length, ref },
    notDelivered: { rows: listOf(notDelivered), total: sum(notDelivered, (o) => o.sales) },
    inProcess: { rows: listOf(inProcess), total: sum(inProcess, (o) => o.sales) },
    notes: {
      untraced: untraced.map((o) => ({ order: o.name, customer: o.customer, sales: o.sales, note: o.state })),
      flagged, duplicates, repeat, unmapped,
      excluded: excluded.map((o) => ({ order: o.name, customer: o.customer, sales: o.total, reason: o.cancelReason })),
    },
    assumptions: {
      costs: Object.entries(PRODUCTS).filter(([k]) => k !== "other").map(([k, p]) => ({ label: p.label, cost: p.cost, units: p.units })),
      tcsPer: DELIVERY_TCS, riderPer: DELIVERY_RIDER, usdMarkup: USD_MARKUP, usdRate: rate, feePct: FEE_PCT,
    },
  };
}

// Profit per order day across a range. The ad spend entered for the whole range is shared between the days in
// the same proportion as Windsor's daily spend (evenly when Windsor has no daily figures), so the days add up to it.
const pkDay = (iso) => new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(0, 10);
export function profitSeries({ date, to, all, outcomes, total, adsDaily = {}, usdRate }) {
  const days = [];
  for (let d = date; d <= to; d = new Date(Date.parse(d + "T00:00:00Z") + 86400000).toISOString().slice(0, 10)) days.push(d);
  const w = days.map((d) => Math.max(0, Number(adsDaily[d]) || 0));
  const wSum = w.reduce((s, x) => s + x, 0);
  let given = 0;
  return days.map((d, i) => {
    const share = i === days.length - 1 ? total - given : Math.round(wSum ? (total * w[i]) / wSum : total / days.length);
    given += share;
    const r = buildReport({ date: d, orders: all.filter((o) => pkDay(o.createdAt) === d), outcomes, ads: { otherMeta: share }, usdRate });
    return { date: d, net: r.pnl.net, adSpend: share, bookedSales: r.kpi.bookedSales, roas: share > 0 ? +(r.kpi.bookedSales / share).toFixed(2) : 0, orders: r.kpi.orders, delivered: r.kpi.delivered, deliveredSales: r.pnl.deliveredSales };
  });
}

export async function profitReport({ date, to = "", ads = {}, adsDaily = {}, usdRate = DEFAULT_USD_RATE, refresh = false } = {}) {
  if (!ISO.test(date || "")) throw new Error("Pick a valid order date.");
  to = ISO.test(to || "") ? to : date;
  if (to < date) throw new Error("The end date is before the start date.");
  const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  if (to > today) throw new Error("That date is in the future.");
  if ((Date.parse(to) - Date.parse(date)) / 86400000 > 30) throw new Error("Pick a range of 31 days or less.");
  const win = { start: pkWindow(date).start, end: pkWindow(to).end };

  // The Total delivery report decides what happened to each order; the full orders (with products) come from Shopify.
  const [rep, listed] = await Promise.all([
    dailyReport(date, { refresh: !!refresh, detail: true, to }),
    perStore(async () => listDay(win.start, win.end)),
  ]);
  if (listed.errors.length) throw new Error("Couldn't read orders: " + listed.errors.map((e) => `${e.store} (${e.error})`).join("; "));
  const outcomes = new Map(rep.rows.map((r) => [keyOf(r.store, r.order), r]));
  const all = listed.rows.map(normOrder);
  const out = buildReport({
    date, dateTo: to, orders: all, outcomes, ads, usdRate, warnings: [...rep.warnings],
    ref: { delivered: rep.totals.delivered, counted: rep.totals.counted, ratio: rep.totals.ratio, riderDelivered: rep.totals.deliveredRider },
  });
  out.cache = rep.cache;
  if (to > date) out.series = profitSeries({ date, to, all, outcomes, total: out.ads.total, adsDaily, usdRate });
  return out;
}
