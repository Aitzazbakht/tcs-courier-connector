// Per-customer WhatsApp delivery status for the reorder offers (sent / delivered / read / not delivered and why).
// Meta tells the WhatsApp webhook about every status change. We keep the latest one per phone number in a shop metafield
// (no database), only for numbers that were queued by the offer sender, so confirmations and other messages are ignored.
import * as shop from "./shopify.js";

const KEY = "wa_offer_status";
const MAX = 20000;
const RANK = { queued: 0, sent: 1, delivered: 2, read: 3 };
export const key10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);

// Plain-language reasons for the common Meta error codes.
export function reason(code, title) {
  const c = Number(code);
  if (c === 131049) return "Meta chose not to deliver (this person got too many marketing messages)";
  if (c === 131026) return "Number can't receive WhatsApp messages";
  if (c === 130472) return "Number is part of a Meta experiment";
  if (c === 131048) return "Spam rate limit";
  if (c === 131047) return "Customer hasn't messaged in 24 hours";
  return title || (code ? "Error " + code : "Not delivered");
}

export async function loadStatus() {
  try { return JSON.parse((await shop.getSetting(KEY)).value || "{}"); } catch { return {}; }
}
async function save(map) { await shop.setSetting(KEY, JSON.stringify(map), "json"); }

// Merge `change(map)` into the stored map and make sure it stuck (two webhooks can write at the same moment).
async function update(change, check) {
  for (let i = 0; i < 3; i++) {
    const map = await loadStatus();
    if (!change(map)) return false;
    if (Object.keys(map).length > MAX) for (const k of Object.keys(map).slice(0, 500)) delete map[k];
    await save(map);
    if (check(await loadStatus())) return true;
  }
  return false;
}

// Before sending: claim these phone numbers so early delivery receipts are not missed.
export async function queue(phones) {
  const now = new Date().toISOString();
  const ph = [...new Set(phones.map(key10).filter(Boolean))];
  if (!ph.length) return;
  await update((m) => { ph.forEach((p) => { m[p] = { i: "", s: "queued", a: now }; }); return true; }, (m) => ph.every((p) => m[p]));
}

// After sending: remember which message id belongs to which number.
export async function seed(ids) {
  const entries = Object.entries(ids).filter(([, id]) => id);
  if (!entries.length) return;
  const now = new Date().toISOString();
  await update((m) => {
    entries.forEach(([p, id]) => { const e = m[key10(p)]; if (e && e.i === id) return; if (e && e.i === "" && e.s !== "queued") { e.i = id; return; } m[key10(p)] = { i: id, s: "sent", a: now }; });
    return true;
  }, (m) => entries.every(([p, id]) => m[key10(p)] && m[key10(p)].i === id));
}

// Webhook: statuses = [{ id, status, recipient_id, timestamp, errors }]
export async function record(statuses) {
  const list = statuses.filter((s) => s && s.id && s.recipient_id);
  if (!list.length) return 0;
  let changed = 0;
  await update((m) => {
    changed = 0;
    for (const s of list) {
      const p = key10(s.recipient_id), e = m[p];
      if (!e) continue; // not one of our offers
      if (e.i && e.i !== s.id) continue; // an older or different message to the same number
      if (!e.i) e.i = s.id;
      const at = new Date(Number(s.timestamp) ? Number(s.timestamp) * 1000 : Date.now()).toISOString();
      if (s.status === "failed") { const er = (s.errors || [])[0] || {}; e.s = "failed"; e.c = er.code || 0; e.t = String(er.title || er.message || "").slice(0, 80); e.a = at; changed++; }
      else if (RANK[s.status] != null && e.s !== "failed" && RANK[s.status] > (RANK[e.s] ?? 0)) { e.s = s.status; e.a = at; changed++; }
    }
    return changed > 0;
  }, (m) => list.every((s) => { const e = m[key10(s.recipient_id)]; return !e || (e.i && e.i !== s.id) || e.s === "failed" || (RANK[e.s] ?? 0) >= (RANK[s.status] ?? 0); }));
  return changed;
}
