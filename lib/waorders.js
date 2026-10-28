// WhatsApp Orders: paste raw WhatsApp orders -> Claude reads them -> plain-code checks -> review -> real Shopify orders (Chitral House, PKR).
// Claude only turns messy text into fields. Every number (totals, delivery, COD) is worked out here from live Shopify prices.
import { createHash } from "node:crypto";
import * as shop from "./shopify.js";
import { withStore } from "./store.js";
import { tcsCities, matchCity } from "./cities.js";

const STORE = "house";
const DELIVERY = 150;
const DUP_DAYS = 14;
const LOG_KEY = "wa_orders_log";
const LOG_MAX = 80;

// What we sell. The variant ids come from the owner; prices and stock are read live from Shopify, never from this table.
export const CATALOG = [
  { key: "shilajit_10g", id: "46650828292380", hint: "Shilajit 10g (10 gram jar)" },
  { key: "shilajit_20g", id: "46650830160156", hint: "Shilajit 20g" },
  { key: "shilajit_30g", id: "46275029172508", hint: "Shilajit 30g" },
  { key: "shilajit_60g_10g", id: "51678886756636", hint: "Shilajit 60g + 10g free offer (written '60g+10g', '60+10')" },
  { key: "bundle_60g_drops", id: "50854560989468", hint: "Bundle: 60g Shilajit + 30ml drops" },
  { key: "drops_30ml", id: "50854554992924", hint: "Shilajit drops 30ml" },
  { key: "gummies_40", id: "52291439952156", hint: "Gummies, 40 pieces" },
  { key: "gummies_60", id: "52291481731356", hint: "Gummies, 60 pieces" },
  { key: "honey_15", id: "53066534846748", hint: "Honey Shilajit 15 sachets" },
  { key: "honey_30", id: "53066539630876", hint: "Honey Shilajit 30 sachets (monthly supply)" },
  { key: "defence_bundle", id: "53930884694300", hint: "Defence Power Bundle" },
];
const gid = (id) => "gid://shopify/ProductVariant/" + id;

let catCache = { at: 0, map: null, error: null };
export async function loadCatalog(force = false) {
  if (!force && catCache.map && Date.now() - catCache.at < 5 * 60 * 1000) return catCache;
  try {
    const d = await withStore(STORE, () => shop.gql(
      `query C($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id title price inventoryQuantity product { title } } } }`,
      { ids: CATALOG.map((c) => gid(c.id)) }));
    const map = {};
    for (const c of CATALOG) {
      const n = (d.nodes || []).find((x) => x && x.id === gid(c.id));
      map[c.key] = n ? { ...c, gid: gid(c.id), title: n.product?.title + (n.title && n.title !== "Default Title" ? " – " + n.title : ""), price: Number(n.price), stock: n.inventoryQuantity } : { ...c, gid: gid(c.id), title: c.hint, price: null, stock: null };
    }
    catCache = { at: Date.now(), map, error: null };
  } catch (e) {
    const map = {};
    for (const c of CATALOG) map[c.key] = { ...c, gid: gid(c.id), title: c.hint, price: null, stock: null };
    catCache = { at: Date.now() - 4.5 * 60 * 1000, map, error: /ACCESS_DENIED|read_products|not approved/i.test(e.message) ? "The app has no read_products permission yet, so live prices can't be read. Approve it and try again." : e.message };
  }
  return catCache;
}

// ---------- Claude: messy text -> fields ----------
const MODEL = () => process.env.WA_MODEL || "claude-haiku-5-5";
const TOOL = {
  name: "submit_orders",
  description: "Submit every order found in the WhatsApp text, copied faithfully. Do not invent or fix anything.",
  input_schema: {
    type: "object",
    properties: {
      orders: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Customer name as written" },
            address: { type: "string", description: "Street address only, as written (keep TCS office text). Do not add the city here unless the sender wrote it as part of the address" },
            city: { type: "string", description: "City as written, empty if none" },
            phones: { type: "array", items: { type: "string" }, description: "Every phone number in the order, exactly as written, first the main one" },
            items: { type: "array", items: { type: "object", properties: { key: { type: "string", description: "A catalog key, or 'unknown'" }, qty: { type: "integer" }, raw: { type: "string", description: "The package text as written" } }, required: ["key", "qty", "raw"] } },
            amount: { type: ["number", "null"], description: "The Amount value as a number (0 if 0). null if there is no amount line or it is unclear" },
            platform: { type: "string", description: "The Platform text exactly as written, empty if missing" },
            note: { type: "string", description: "Any extra remark that does not fit another field, else empty" },
          },
          required: ["name", "address", "city", "phones", "items", "amount", "platform"],
        },
      },
    },
    required: ["orders"],
  },
};

async function askClaude(text, cat) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set in Vercel yet (Settings, Environment Variables), then redeploy.");
  const keys = CATALOG.map((c) => "- " + c.key + ": " + (cat.map?.[c.key]?.title || c.hint) + " (" + c.hint + ")").join("\n");
  const system = "You read raw WhatsApp orders for a Pakistani shilajit shop and return structured data through the tool. Orders look like:\n" +
    "Name :: ...\nAddress :: ...\nCity :: ...\nMobile :: ... (maybe several numbers)\nPKG :: package\nAmount :: COD amount in Rs\nPlatform :: where the customer came from\n" +
    "Copy values faithfully; never guess or correct a missing value (use empty string or null). A message may hold one order or several. " +
    "For PKG choose the best catalog key (quantity defaults to 1; '2 x 30g' is qty 2). If the package matches nothing clearly, use key 'unknown' and put the text in raw.\nCatalog keys:\n" + keys;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 40000);
  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL(), max_tokens: 2000, system, tools: [TOOL], tool_choice: { type: "tool", name: "submit_orders" }, messages: [{ role: "user", content: text }] }),
    });
  } catch (e) { throw new Error(e.name === "AbortError" ? "Claude took too long to answer" : "Could not reach Claude: " + e.message); }
  finally { clearTimeout(timer); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = d?.error?.message || ("HTTP " + r.status);
    throw new Error(r.status === 401 ? "The Claude API key was rejected (check ANTHROPIC_API_KEY)" : /credit|billing/i.test(m) ? "Claude API credit is empty. Add credit in the Anthropic Console." : "Claude error: " + m);
  }
  const t = (d.content || []).find((c) => c.type === "tool_use");
  if (!t) throw new Error("Claude returned no order data");
  return Array.isArray(t.input?.orders) ? t.input.orders : [];
}

// Split a paste into one block per order so each order is read on its own, in parallel.
export function splitBlocks(text) {
  const t = String(text || "").replace(/\r/g, "").trim();
  if (!t) return [];
  let parts = t.split(/\n(?=\s*(?:name|customer)\s*[:：-]{1,2})/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) parts = t.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [t];
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

// ---------- plain-code helpers ----------
export function normPhone(p) {
  let d = String(p || "").replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0092")) d = d.slice(4);
  else if (d.startsWith("92") && d.length >= 11) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  if (!/^\d{9,10}$/.test(d)) return "";
  if (d.length === 10 && d[0] === "3") return "+92" + d; // mobile
  if (d.length >= 9) return "+92" + d; // landline / other
  return "";
}
const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const wordsOf = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => (w.length > 1 || /\d/.test(w)) && !["house", "street", "road", "lahore", "karachi", "town", "block", "near", "no", "the", "of", "and", "colony", "phase", "sector"].includes(w));
const nameKey = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
function addrSimilar(a, b) {
  const A = new Set(wordsOf(a)), B = new Set(wordsOf(b));
  if (!A.size || !B.size) return false;
  let hit = 0; for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size) >= 0.6 && (hit >= 2 || Math.min(A.size, B.size) <= 2);
}
const money = (n) => Math.round(Number(n) * 100) / 100;

// Platform text -> Shopify tags. Order of the rules matters (longer phrases first).
const PLAT = [
  [/someone\s*refer\w*|refer\w*/g, "Referral"],
  [/re[\s-]*send\b|resend\b/g, "Resend"],
  [/re[\s-]*cust\w*|repeat\s*cust\w*/g, "Repeat Customer"],
  [/chitral\s*herbs?|c\s*herbs?|cherbs/g, "Chitral Herbs"],
  [/chitral\s*house|c\s*house|chouse/g, "Chouse"],
  [/\b(?:fb|facebook|face\s*book|meta)\b/g, "Facebook"],
  [/\b(?:insta|instagram|ig)\b/g, "Instagram"],
  [/\b(?:tik\s*tok|tiktok|tt)\b/g, "TikTok"],
  [/\bgoogle\b/g, "Google"],
  [/\b(?:youtube|yt)\b/g, "YouTube"],
];
export const PLATFORM_TAGS = ["Facebook", "Instagram", "TikTok", "Google", "YouTube", "Chouse", "Chitral Herbs", "Repeat Customer", "Referral", "Resend"];
export function platformFrom(raw) {
  let s = " " + String(raw || "").toLowerCase().replace(/[&+,/|]/g, " ") + " ";
  const tags = [];
  for (const [re, tag] of PLAT) { if (re.test(s)) { if (!tags.includes(tag)) tags.push(tag); s = s.replace(re, " "); } re.lastIndex = 0; }
  let friend = false;
  if (/\bfriends?\b/.test(s)) { friend = true; s = s.replace(/\bfriends?\b/g, " "); }
  const unknown = s.split(/[^a-z]+/).filter((w) => w.length >= 2 && !["customer", "and", "from", "via", "ad", "ads", "order", "the", "by", "of", "wa", "whatsapp"].includes(w));
  return { tags, friend, unknown };
}

// ---------- recent orders (for duplicate checks) ----------
let recent = { at: 0, rows: null };
async function recentOrders(force) {
  if (!force && recent.rows && Date.now() - recent.at < 3 * 60 * 1000) return recent.rows;
  const since = new Date(Date.now() - DUP_DAYS * 86400000).toISOString();
  const rows = []; let after = null;
  await withStore(STORE, async () => {
    while (rows.length < 4000) {
      const d = await shop.gql(
        `query R($q: String!, $after: String) { orders(first: 250, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) { pageInfo { hasNextPage endCursor }
          nodes { name createdAt cancelledAt phone sourceIdentifier tags shippingAddress { name phone address1 } } } }`,
        { q: "created_at:>='" + since + "'", after });
      rows.push(...d.orders.nodes);
      if (!d.orders.pageInfo.hasNextPage) break;
      after = d.orders.pageInfo.endCursor;
    }
  });
  recent = { at: Date.now(), rows: rows.filter((o) => !o.cancelledAt) };
  return recent.rows;
}

export function hashOf(o, items) {
  const k = [nameKey(o.name), last10(o.phone), wordsOf(o.address).join(" "), items.map((i) => i.key + ":" + i.qty).sort().join(","), String(o.amount)].join("|") + (o.salt ? "|" + o.salt : "");
  return createHash("sha256").update(k).digest("hex").slice(0, 16);
}

export const catList = (cat) => Object.values(cat.map).map((c) => ({ key: c.key, title: c.title, price: c.price }));

// ---------- the checks ----------
// `o` is the editable order (from Claude, then edited in the page). Returns it filled with totals, tags, flags and a status.
export function checkOrder(o, ctx) {
  const { cat, cities, recentRows, batch, idx } = ctx;
  const flags = [];
  const flag = (code, sev, msg, fix = []) => flags.push({ code, sev, msg, fix });
  const ack = new Set(o.ack || []);
  const out = { ...o };
  out.name = String(o.name || "").replace(/\s+/g, " ").trim();
  out.name = out.name.replace(/(^|\s)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  out.address = String(o.address || "").replace(/\s+/g, " ").trim();

  if (!out.name) flag("name", "block", "Name is missing");
  if (!out.address) flag("address", "block", "Address is missing");

  // phones
  const rawPhones = (Array.isArray(o.phones) ? o.phones : []).map((p) => String(p || "").trim()).filter(Boolean);
  const good = rawPhones.map(normPhone);
  out.phone = good.find(Boolean) || "";
  out.altPhones = [...new Set(good.filter((g) => g && g !== out.phone))];
  if (!rawPhones.length) flag("phone", "block", "Phone number is missing");
  else if (!out.phone) flag("phone", "block", "Phone number looks wrong: " + rawPhones.join(", "));
  else if (rawPhones.some((p, i) => !good[i])) flag("phone2", "warn", "One of the numbers could not be read: " + rawPhones.filter((p, i) => !good[i]).join(", "), [{ label: "Ignore it", patch: { ackAdd: "phone2" } }]);

  // city
  const cityText = String(o.city || "").trim();
  out.cityShown = cityText;
  if (!cityText) flag("city", "block", "City is missing");
  else if (cities) {
    const m = matchCity(cities, cityText, "");
    const a = matchCity(cities, "", out.address);
    if (!m) flag("city", "warn", "City '" + cityText + "' is not a TCS city", [{ label: "Use it anyway", patch: { ackAdd: "city" } }]);
    else {
      out.cityShown = ["exact", "alias", "fuzzy"].includes(m.how) ? m.name.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) : cityText;
      if (a && a.code !== m.code) flag("citymix", "warn", "City says " + m.name + " but the address mentions " + a.name, [{ label: "Use " + a.name, patch: { city: a.name } }, { label: "Keep " + m.name, patch: { ackAdd: "citymix" } }]);
    }
  }

  // items and prices
  const items = [];
  for (const it of Array.isArray(o.items) ? o.items : []) {
    const qty = Math.max(1, Math.round(Number(it.qty) || 1));
    const c = it.key && cat.map[it.key];
    if (!c) { items.push({ key: "unknown", qty, raw: it.raw || "", title: it.raw || "Unknown package", price: null }); continue; }
    items.push({ key: it.key, qty, raw: it.raw || "", title: c.title, price: c.price, gid: c.gid, stock: c.stock });
  }
  const custom = (Array.isArray(o.custom) ? o.custom : []).map((c) => ({ title: String(c.title || "Custom item"), qty: Math.max(1, Math.round(Number(c.qty) || 1)), price: Number(c.price) || 0 }));
  out.items = items; out.custom = custom;
  const amount = o.amount === null || o.amount === undefined || o.amount === "" ? null : Number(o.amount);
  out.amount = Number.isFinite(amount) ? amount : null;

  if (!items.length && !custom.length) flag("items", "block", "No package found in the order", []);
  for (const it of items) {
    if (it.key === "unknown") {
      const fix = Object.values(cat.map).map((c) => ({ label: c.title.slice(0, 38) + (c.price != null ? " (Rs " + c.price + ")" : ""), patch: { replaceItem: { raw: it.raw, key: c.key } } })).slice(0, 12);
      if (out.amount) fix.unshift({ label: "Custom item at Rs " + out.amount, patch: { replaceItem: { raw: it.raw, custom: { title: it.raw || "Custom item", price: out.amount } } } });
      flag("unknown", "block", "Package '" + it.raw + "' is not in the catalog. Pick the product:", fix);
    } else if (it.price == null) flag("price", "block", "Live price for " + it.title + " could not be read from Shopify" + (cat.error ? " (" + cat.error + ")" : ""), []);
    else if (it.stock != null && it.stock <= 0) flag("stock", "warn", it.title + " shows no stock", [{ label: "Create anyway", patch: { ackAdd: "stock" } }]);
  }
  const itemsTotal = money(items.reduce((s, i) => s + (i.price || 0) * i.qty, 0) + custom.reduce((s, c) => s + c.price * c.qty, 0));

  // platform
  const plat = platformFrom(o.platform);
  const tagsPlat = Array.isArray(o.platformTags) ? o.platformTags : plat.tags;
  out.platTags = tagsPlat;
  const friend = plat.friend;

  // money
  let mode = "cod", delivery = 0, discount = money(Number(o.discount) || 0), collect = 0;
  if (out.amount === 0) mode = friend ? "free" : "prepaid";
  const base = money(itemsTotal - discount);
  if (mode === "cod") {
    if (out.amount === null) flag("amount", "block", "COD amount is missing. Ask the customer or type it in", []);
    else {
      if (typeof o.delivery === "number") delivery = o.delivery;
      else if (money(out.amount) === base) delivery = 0;
      else if (money(out.amount) === money(base + DELIVERY)) delivery = DELIVERY;
      collect = money(base + delivery);
      if (itemsTotal > 0 && money(out.amount) !== collect) {
        const fix = [{ label: "Set amount to Rs " + base, patch: { amount: base, delivery: null } }, { label: "Set amount to Rs " + money(base + DELIVERY) + " (with Rs " + DELIVERY + " delivery)", patch: { amount: money(base + DELIVERY), delivery: null } }];
        if (out.amount < base) fix.push({ label: "Give Rs " + money(itemsTotal - out.amount) + " discount", patch: { discount: money(itemsTotal - out.amount), delivery: null } });
        else fix.push({ label: "Charge Rs " + money(out.amount - base) + " as delivery", patch: { delivery: money(out.amount - base) } });
        flag("mismatch", "block", "Amount Rs " + out.amount + " does not match the total Rs " + itemsTotal + (discount ? " (less Rs " + discount + " discount)" : "") + " or total plus Rs " + DELIVERY + " delivery", fix);
      }
    }
  } else if (mode === "prepaid") collect = 0;
  out.mode = mode; out.deliveryFee = delivery; out.itemsTotal = itemsTotal;
  out.total = mode === "free" ? 0 : money(itemsTotal - discount + delivery);
  out.discount = discount;
  out.collect = mode === "cod" ? collect : 0;

  if (!String(o.platform || "").trim() && !Array.isArray(o.platformTags)) flag("platform", "warn", "Platform is missing", [...PLATFORM_TAGS.slice(0, 7).map((t) => ({ label: t, patch: { platformTags: [t] } })), { label: "No platform tag", patch: { ackAdd: "platform" } }]);
  else if (!Array.isArray(o.platformTags) && (plat.unknown.length || (!plat.tags.length && !friend))) flag("platform", "warn", "Platform '" + o.platform + "' is not recognised", [...PLATFORM_TAGS.slice(0, 7).map((t) => ({ label: t, patch: { platformTags: [t] } })), { label: "No platform tag", patch: { ackAdd: "platform" } }]);
  else if (friend && mode !== "free") flag("friend", "warn", "Platform says friend but the amount is not 0", [{ label: "Make it a free gift (amount 0)", patch: { amount: 0 } }, { label: "Treat as normal order", patch: { ackAdd: "friend" } }]);

  // tags and note
  const tags = ["WhatsApp"];
  if (mode !== "free") tags.push(mode === "cod" ? "COD" : "Prepaid");
  for (const t of tagsPlat) if (!tags.includes(t)) tags.push(t);
  if (mode === "free") tags.push("Free Gift");
  if (o.isTest) tags.push("Test");
  out.tags = tags;
  const plainPlat = String(o.platform || "").trim() || tagsPlat.join(" ");
  out.orderNote = "WhatsApp order (Platform: " + plainPlat + ")." + (mode === "cod" ? " COD amount: Rs " + out.amount + "." : mode === "free" ? " Free gift." : " Prepaid.") +
    (out.altPhones.length ? " Alternate contact: " + out.altPhones.join(", ") + "." : "") + (o.note ? " " + String(o.note).trim() : "");

  // duplicates (live shop, and inside this paste)
  out.hash = hashOf({ ...out, salt: o.salt }, items.length ? items : custom.map((c) => ({ key: c.title, qty: c.qty })));
  const dupes = [];
  if (out.phone || out.name) {
    for (const r of recentRows || []) {
      if (r.sourceIdentifier && r.sourceIdentifier === "wa-" + out.hash) { dupes.push({ same: true, order: r.name, why: "exact same order already created" }); continue; }
      const rp = [r.phone, r.shippingAddress?.phone].map(last10);
      const byPhone = out.phone && rp.includes(last10(out.phone));
      const byName = nameKey(out.name) && nameKey(r.shippingAddress?.name) === nameKey(out.name) && addrSimilar(out.address, r.shippingAddress?.address1);
      if (byPhone || byName) dupes.push({ order: r.name, at: r.createdAt, why: byPhone ? "same phone" : "same name and address" });
    }
  }
  for (let j = 0; j < (batch || []).length; j++) {
    if (j === idx) continue; const b = batch[j];
    if (b.skip) continue;
    const same = (out.phone && last10(b.phone) === last10(out.phone)) || (nameKey(out.name) && nameKey(b.name) === nameKey(out.name) && addrSimilar(out.address, b.address));
    if (same && j < idx) dupes.push({ order: "#" + (j + 1) + " in this paste", why: "same customer appears twice in this paste" });
  }
  out.dupes = dupes.slice(0, 4);
  if (dupes.length) {
    const exact = dupes.some((d) => d.same);
    flag("dup", "warn", (exact ? "Already created: " : "Possible duplicate: ") + dupes.slice(0, 3).map((d) => d.order + " (" + d.why + (d.at ? ", " + d.at.slice(0, 10) : "") + ")").join("; "),
      [{ label: "Skip this order", patch: { skip: true } }, { label: "Create anyway", patch: { ackAdd: "dup", salt: exact ? String(Date.now() % 100000) : undefined } }]);
  }

  // status
  out.flags = flags.filter((f) => !(f.sev === "warn" && ack.has(f.code)));
  out.status = o.skip ? "skipped" : out.flags.some((f) => f.sev === "block") ? "blocked" : out.flags.length ? "attention" : "ready";
  return out;
}

async function context() {
  const [cat, cities, recentRows] = await Promise.all([
    loadCatalog(),
    tcsCities().catch(() => null),
    recentOrders(false).catch((e) => { recent.err = e.message; return null; }),
  ]);
  return { cat, cities, recentRows, warnings: [cat.error, !cities ? "TCS city list is not available, so city names were not checked." : "", !recentRows ? "Recent orders could not be read, so duplicates were not checked." : ""].filter(Boolean) };
}

export function checkAll(orders, ctx) {
  const first = orders.map((o, i) => checkOrder(o, { ...ctx, batch: [], idx: i }));
  return orders.map((o, i) => checkOrder(o, { ...ctx, batch: first, idx: i }));
}

// Is this phone already a customer? One aliased query for the whole batch.
const custCache = new Map();
async function withCustomers(orders) {
  try {
    const need = [...new Set(orders.map((o) => o.phone).filter((p) => /^\+\d{9,13}$/.test(p || "") && !(custCache.get(p) && Date.now() - custCache.get(p).at < 180000)))];
    if (need.length) {
      const q = "query {" + need.map((p, i) => " c" + i + ': customers(first: 1, query: "phone:' + p + '") { nodes { id displayName numberOfOrders } }').join("") + " }";
      const d = await withStore(STORE, () => shop.gql(q));
      need.forEach((p, i) => { const n = d["c" + i]?.nodes?.[0]; custCache.set(p, { at: Date.now(), v: n ? { name: n.displayName, orders: Number(n.numberOfOrders) || 0 } : null }); });
    }
    for (const o of orders) { const c = custCache.get(o.phone); if (c) o.customer = c.v; }
  } catch { /* the label is a courtesy; checks still work without it */ }
  return orders;
}

// Paste -> parsed + checked orders
export async function analyze(text) {
  const blocks = splitBlocks(text);
  if (!blocks.length) throw new Error("Paste at least one order first");
  if (blocks.length > 60) throw new Error("That is " + blocks.length + " orders. Paste 60 or fewer at a time.");
  const ctxP = context();
  const cat = await loadCatalog();
  const parsed = await pool(blocks, 8, async (b) => {
    try { return (await askClaude(b, cat)).map((o) => ({ ...o, raw: b })); }
    catch (e) { return [{ raw: b, parseError: e.message }]; }
  });
  const ctx = await ctxP;
  const flat = parsed.flat();
  const bad = flat.find((o) => o.parseError);
  if (bad && flat.every((o) => o.parseError)) throw new Error(bad.parseError);
  const orders = flat.map((o) => o.parseError ? { raw: o.raw, name: "", address: "", city: "", phones: [], items: [], amount: null, platform: "", parseError: o.parseError } : { ...o, phones: o.phones || [], items: o.items || [] });
  const checked = checkAll(orders, ctx).map((c, i) => orders[i].parseError ? { ...c, status: "blocked", flags: [{ code: "parse", sev: "block", msg: "Could not read this order: " + orders[i].parseError, fix: [] }, ...c.flags] } : c);
  await withCustomers(checked);
  return { orders: checked, warnings: ctx.warnings, model: MODEL(), catalog: catList(ctx.cat) };
}

export async function recheck(orders) {
  const ctx = await context();
  const checked = await withCustomers(checkAll(orders, ctx));
  return { orders: checked, warnings: ctx.warnings, catalog: catList(ctx.cat) };
}

// ---------- creating orders ----------
const MUT = `mutation Create($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
  orderCreate(order: $order, options: $options) {
    order { id name displayFinancialStatus totalPriceSet { shopMoney { amount } } customer { id numberOfOrders } shippingAddress { address1 } }
    userErrors { field message code }
  }
}`;
const M = (n) => ({ shopMoney: { amount: Number(n).toFixed(2), currencyCode: "PKR" } });

export function buildInput(o, customerId) {
  const parts = o.name.split(" ");
  const first = parts.shift(), last = parts.join(" ");
  const lineItems = [
    ...o.items.map((i) => ({ variantId: i.gid, quantity: i.qty, priceSet: M(i.price) })),
    ...o.custom.map((c) => ({ title: c.title, quantity: c.qty, priceSet: M(c.price), requiresShipping: true, taxable: false })),
  ];
  const input = {
    currency: "PKR",
    sourceIdentifier: "wa-" + o.hash,
    phone: o.phone,
    tags: o.tags,
    note: o.orderNote,
    lineItems,
    ...(customerId ? { customer: { toAssociate: { id: customerId } } } : {}),
    shippingAddress: { firstName: first, lastName: last || ".", address1: o.address, city: o.cityShown, countryCode: "PK", phone: o.phone },
    financialStatus: o.mode === "cod" ? "PENDING" : "PAID",
  };
  if (o.deliveryFee > 0) input.shippingLines = [{ title: "Delivery", priceSet: M(o.deliveryFee) }];
  if (o.mode === "free") input.discountCode = { itemPercentageDiscountCode: { code: "Free Gift", percentage: 100 } };
  else if (o.discount > 0) input.discountCode = { itemFixedDiscountCode: { code: "Manual discount", amountSet: M(o.discount) } };
  if (o.mode === "prepaid") input.transactions = [{ kind: "SALE", status: "SUCCESS", gateway: "Prepaid", amountSet: M(o.total) }];
  return input;
}

export async function readLog() {
  const s = await shop.getSetting(LOG_KEY);
  try { return JSON.parse(s.value || "[]"); } catch { return []; }
}
async function writeLog(rows) {
  rows = rows.slice(0, LOG_MAX);
  let v = JSON.stringify(rows);
  while (v.length > 60000 && rows.length > 5) { rows = rows.slice(0, rows.length - 5); v = JSON.stringify(rows); }
  await shop.setSetting(LOG_KEY, v, "json");
}

export async function createOrders(orders, { deadlineMs = 48000 } = {}) {
  const t0 = Date.now();
  recent.at = 0; // re-read recent orders so repeat clicks see what was just created
  const ctx = await context();
  const checked = checkAll(orders, ctx);
  const results = new Array(orders.length);
  const todo = [];
  checked.forEach((c, i) => {
    if (c.skip) results[i] = { status: "skipped" };
    else if (c.status !== "ready") results[i] = { status: "not_ready", error: c.flags.map((f) => f.msg).join("; ") || "Not ready" };
    else todo.push(i);
  });
  const logRows = [];
  await withStore(STORE, async () => {
    await pool(todo, 4, async (i) => {
      const c = checked[i];
      if (Date.now() - t0 > deadlineMs) { results[i] = { status: "later", error: "Out of time, press Create again for the rest" }; return; }
      try {
        let cust = null, custNote = "";
        try {
          try { cust = await customerFor(c); }
          catch (e1) { if (!/access|scope|permission/i.test(e1.message)) throw e1; shop.forgetTokens(); cust = await customerFor(c); } // new permission: sign in again once
        } catch (e) { custNote = /access|scope|permission|write_customers/i.test(e.message) ? "customer not linked: the app needs the write_customers permission" : "customer not linked: " + e.message; }
        const d = await shop.gql(MUT, { order: buildInput(c, cust?.id), options: { inventoryBehaviour: "DECREMENT_IGNORING_POLICY", sendReceipt: false, sendFulfillmentReceipt: false } });
        const r = d.orderCreate;
        if (r.userErrors?.length || !r.order) { results[i] = { status: "failed", error: (r.userErrors || []).map((e) => e.message).join("; ") || "Shopify did not create the order" }; return; }
        custCache.delete(c.phone);
        let addrNote = "";
        if (!r.order.shippingAddress?.address1) { // Shopify silently dropped the address: put it back and say so
          try {
            const u = await shop.gql(`mutation U($i: OrderInput!) { orderUpdate(input: $i) { order { shippingAddress { address1 } } userErrors { message } } }`, { i: { id: r.order.id, shippingAddress: buildInput(c, cust?.id).shippingAddress } });
            addrNote = u.orderUpdate.order?.shippingAddress?.address1 ? "" : "the address did not save, add it by hand";
          } catch (e) { addrNote = "the address did not save, add it by hand"; }
        }
        results[i] = { status: "created", id: r.order.id, name: r.order.name, total: r.order.totalPriceSet.shopMoney.amount, customerOrders: r.order.customer?.numberOfOrders ?? null, customerNote: [custNote, addrNote].filter(Boolean).join("; ") };
        logRows.push({ at: new Date().toISOString(), id: r.order.id, name: r.order.name, state: "created", customer: c.name, phone: c.phone, total: c.total, mode: c.mode, tags: c.tags, raw: String(c.raw || "").slice(0, 900), parsed: { name: c.name, address: c.address, city: c.cityShown, phone: c.phone, items: c.items.map((x) => x.key + " x" + x.qty).concat(c.custom.map((x) => x.title + " x" + x.qty)), amount: c.amount, platform: c.platform }, edits: c.edits || [] });
        recent.rows = [{ name: r.order.name, createdAt: new Date().toISOString(), phone: c.phone, sourceIdentifier: "wa-" + c.hash, shippingAddress: { name: c.name, phone: c.phone, address1: c.address } }, ...(recent.rows || [])];
      } catch (e) { results[i] = { status: "failed", error: e.message }; }
    });
  });
  let logError = "";
  if (logRows.length) { try { await writeLog([...logRows, ...(await readLog())]); } catch (e) { logError = e.message; } }
  return { results, checked, logError };
}

// Shopify's order input cannot make a customer from a phone alone, so find the customer by phone or create one first.
async function customerFor(o) {
  const find = async () => (await shop.gql(`query F($q: String!) { customers(first: 1, query: $q) { nodes { id } } }`, { q: "phone:" + o.phone })).customers.nodes[0]?.id || null;
  const found = await find();
  if (found) return { id: found, how: "existing" };
  const parts = o.name.split(" "); const first = parts.shift(), last = parts.join(" ");
  const d = await shop.gql(`mutation M($i: CustomerInput!) { customerCreate(input: $i) { customer { id } userErrors { field message } } }`,
    { i: { firstName: first, ...(last ? { lastName: last } : {}), phone: o.phone } });
  const r = d.customerCreate;
  if (r.customer?.id) return { id: r.customer.id, how: "new" };
  const again = await find();
  if (again) return { id: again, how: "existing" };
  throw new Error((r.userErrors || []).map((e) => e.message).join("; ") || "customer not created");
}

const CANCEL = `mutation Cancel($id: ID!, $note: String) { orderCancel(orderId: $id, reason: OTHER, restock: true, notifyCustomer: false,
  refundMethod: { originalPaymentMethodsRefund: false }, staffNote: $note) { job { id } orderCancelUserErrors { field message code } } }`;

export async function undoOrder(id) {
  if (!/^gid:\/\/shopify\/Order\/\d+$/.test(String(id))) throw new Error("Bad order id");
  const log = await readLog();
  const row = log.find((r) => r.id === id);
  if (!row) throw new Error("That order is not in the WhatsApp orders log, so it will not be cancelled from here");
  if (row.state === "undone") return { already: true };
  await withStore(STORE, async () => {
    const d = await shop.gql(CANCEL, { id, note: "WhatsApp order undone from the app" });
    const e = d.orderCancel.orderCancelUserErrors; if (e?.length) throw new Error("Cancel failed: " + e.map((x) => x.message).join("; "));
  });
  row.state = "undone"; row.undoneAt = new Date().toISOString();
  await writeLog(log);
  recent.at = 0;
  return { ok: true, name: row.name };
}
