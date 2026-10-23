// Packaging-parts stock tracker (moved here from the Claude artifact "Chitral House Stock").
// One JSON document kept in a shop setting: parts, product recipes, the opening base and every entry since.
import * as shop from "./shopify.js";
import seed from "./stock-seed.js";

const KEY = "stock_state";
const TYPES = ["dispatch", "return", "receive", "count", "writeoff"];
const MAX_MOVES = 1500;
const r1 = (n) => Math.round(n * 10) / 10;
const clone = (x) => JSON.parse(JSON.stringify(x));

export async function loadState() {
  let v = null;
  try { v = (await shop.getSetting(KEY)).value; } catch (e) { throw new Error("Couldn't read the stock data: " + e.message); }
  if (!v) return clone(seed);
  try {
    const s = JSON.parse(v);
    if (s && s.comps && s.prods && s.base && Array.isArray(s.moves)) {
      // Saved before auto-deduction existed: bring in the parcel log and the artifact's automatic entries so nothing is counted twice.
      if (!s.tcs) {
        const have = new Set(s.moves.map((m) => m.id));
        for (const m of seed.moves) if (/^auto-/.test(m.id) && !have.has(m.id)) s.moves.push(clone(m));
        s.tcs = clone(seed.tcs); s.auto = s.auto || clone(seed.auto);
      }
      for (const [id, p] of Object.entries(seed.prods)) if (!s.prods[id]) s.prods[id] = clone(p); // products added to the seed later
      return s;
    }
  } catch {}
  throw new Error("The saved stock data is unreadable. Nothing was changed.");
}
export async function saveState(s) {
  s.moves.sort((a, b) => a.at.localeCompare(b.at));
  if (s.moves.length > MAX_MOVES) {
    // Tidy up automatically: fold the oldest entries into the starting count so the totals never change.
    const drop = s.moves.length - MAX_MOVES + 300;
    const old = s.moves.slice(0, drop), qty = { ...(s.base.qty || {}) };
    for (const m of old) if (m.at > (s.base.at || "")) for (const [c, d] of Object.entries(m.delta || {})) qty[c] = r1((qty[c] || 0) + d);
    s.base = { at: old[old.length - 1].at > (s.base.at || "") ? old[old.length - 1].at : s.base.at, qty, rolledAt: new Date().toISOString() };
    s.moves = s.moves.slice(drop);
  }
  await shop.setSetting(KEY, JSON.stringify(s), "json");
  return s;
}
export function currentStock(s) {
  const q = { ...(s.base.qty || {}) };
  for (const m of s.moves) if (m.at > (s.base.at || "")) for (const [c, d] of Object.entries(m.delta || {})) q[c] = r1((q[c] || 0) + d);
  return q;
}
const view = (s) => ({ comps: s.comps, prods: s.prods, base: s.base, moves: s.moves, auto: s.auto || { startDate: "", returnsFrom: "" }, autoLog: s.autoLog || [] });

export async function stockGet() { return view(await loadState()); }

export async function stockMove(m = {}) {
  const s = await loadState();
  if (!TYPES.includes(m.type)) throw new Error("Unknown entry type");
  const delta = {};
  for (const [c, d] of Object.entries(m.delta || {})) {
    if (!s.comps[c]) throw new Error("Unknown part: " + c);
    const n = Number(d); if (!Number.isFinite(n)) throw new Error("Bad quantity for " + c);
    if (n) delta[c] = r1(n);
  }
  if (!Object.keys(delta).length) throw new Error("Nothing to save");
  const items = {};
  for (const [p, n] of Object.entries(m.items || {})) if (s.prods[p] && Number(n) > 0) items[p] = Math.round(Number(n));
  const at = new Date().toISOString();
  s.moves.push({
    id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at,
    day: /^\d{4}-\d{2}-\d{2}$/.test(m.day || "") ? m.day : at.slice(0, 10), type: m.type,
    channel: String(m.channel || "").slice(0, 40), note: String(m.note || "").slice(0, 200),
    items, parcels: Math.max(0, Math.round(Number(m.parcels) || 0)), delta, by: "app",
  });
  return view(await saveState(s));
}
export async function stockUndo(id) {
  const s = await loadState();
  const i = s.moves.findIndex((m) => m.id === id);
  if (i < 0) throw new Error("That entry no longer exists");
  if (s.moves[i].at <= (s.base.at || "")) throw new Error("Entries before the last tidy-up can't be undone");
  s.moves.splice(i, 1);
  return view(await saveState(s));
}
export async function stockAlert(id, reorder) {
  const s = await loadState();
  if (!s.comps[id]) throw new Error("Unknown part");
  const n = Number(reorder); if (!Number.isFinite(n) || n < 0) throw new Error("Enter a number, or leave it empty to turn the alert off.");
  s.comps[id].reorder = Math.round(n);
  return view(await saveState(s));
}
export async function stockRoll() {
  const s = await loadState();
  const last = s.moves.reduce((x, m) => (m.at > x ? m.at : x), s.base.at || "");
  s.base = { at: last, qty: currentStock(s), rolledAt: new Date().toISOString() };
  return view(await saveState(s));
}
export async function stockAutoDates(startDate, returnsFrom) {
  const ok = (d) => d === "" || /^\d{4}-\d{2}-\d{2}$/.test(d || "");
  if (!ok(startDate) || !ok(returnsFrom)) throw new Error("Dates must be YYYY-MM-DD");
  const s = await loadState();
  s.auto = { startDate: startDate || "", returnsFrom: returnsFrom || "" };
  return view(await saveState(s));
}
