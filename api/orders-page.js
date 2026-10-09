// Orders page: /orders/<CONNECTOR_KEY>
import { keyOk } from "../lib/auth.js";

export default function handler(req, res) {
  const key = new URL(req.url, "http://x").searchParams.get("key");
  if (!keyOk(key)) return res.status(403).send("Forbidden");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.status(200).send(PAGE.replace("__KEY__", JSON.stringify(key)));
}

const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>TCS Orders · Chitral House</title>
<style>
:root{--bg:#f6f5f2;--card:#fff;--ink:#1d1d1b;--mute:#6b6a66;--line:#e4e2dc;--accent:#14532d;--accent-ink:#fff;--warn:#9a3412;--warn-bg:#fff4ed;--ok:#166534;--ok-bg:#ecfdf3;--chip:#f0eee8}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--ink:#ecebe7;--mute:#a09f9a;--line:#33322f;--accent:#4ade80;--accent-ink:#0b1a10;--warn:#fdba74;--warn-bg:#2a1a10;--ok:#86efac;--ok-bg:#0f2417;--chip:#2a2a27}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:14px 16px}
.wrap{max-width:1200px;margin:0 auto}
.top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
h1{font-size:18px;margin:0}h1 small{color:var(--mute);font-weight:400;font-size:13px;margin-left:6px}
.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:8px 12px;border-radius:8px;cursor:pointer}
button.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:600}
button:disabled{opacity:.5;cursor:not-allowed}
.toggle{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--line);border-radius:999px;background:var(--card)}
.switch{position:relative;width:38px;height:22px;border-radius:999px;background:var(--line);border:0;padding:0}
.switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}
.switch.on{background:var(--accent)}.switch.on::after{left:19px}
main{padding:16px}
.summary{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
.pill{background:var(--chip);border-radius:999px;padding:4px 10px;font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:20px}
.card h2{font-size:15px;margin:0;padding:12px 14px;border-bottom:1px solid var(--line)}
.scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:900px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;color:var(--mute);font-weight:600;text-transform:uppercase;letter-spacing:.03em;background:var(--card)}
tr:last-child td{border-bottom:0}
td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.muted{color:var(--mute);font-size:12px}
.issue{color:var(--warn);background:var(--warn-bg);border-radius:6px;padding:2px 6px;font-size:12px;display:inline-block;margin-top:3px}
.res-ok{color:var(--ok);background:var(--ok-bg);border-radius:6px;padding:2px 6px;font-size:12px;display:inline-block}
select{font:inherit;max-width:170px;padding:4px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)}
select.bad{border-color:var(--warn)}
a{color:var(--accent)}
#log{font-size:13px;color:var(--mute);min-height:18px}
.empty{padding:24px;text-align:center;color:var(--mute)}
@media (max-width:640px){h1{font-size:16px}header{padding:12px 16px}}
</style></head>
<body>
<header><div class="wrap top">
  <h1>TCS Orders <small>Chitral House</small></h1>
  <div class="actions">
    <div class="toggle"><span>Auto-book new orders</span><button id="auto" class="switch" aria-label="Auto-book" role="switch"></button></div>
    <button id="refresh">Refresh</button>
    <button id="pushSel" class="primary" disabled>Push selected</button>
    <button id="pushAll" class="primary">Push all ready</button>
  </div>
</div><div class="wrap" id="log"></div></header>
<main class="wrap">
  <div class="summary" id="summary"></div>
  <div class="card"><h2>Waiting to book</h2><div class="scroll"><table>
    <thead><tr><th><input type="checkbox" id="all"></th><th>Order</th><th>Customer</th><th>City</th><th class="num">COD</th><th>Products</th><th>Status</th></tr></thead>
    <tbody id="pending"><tr><td colspan="7" class="empty">Loading orders…</td></tr></tbody></table></div></div>
  <div class="card"><h2>Recently booked</h2><div class="scroll"><table>
    <thead><tr><th>Order</th><th>Customer</th><th>CN</th><th>Shopify</th><th>Label</th></tr></thead>
    <tbody id="booked"></tbody></table></div></div>
</main>
<script>
const KEY = __KEY__;
const API = "/api/orders?key=" + encodeURIComponent(KEY);
let state = { pending: [], booked: [], cities: [], auto: false };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const log = (m) => { $("#log").textContent = m; };
const rs = (n) => "Rs " + Number(n || 0).toLocaleString("en-PK");
const when = (d) => new Date(d).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function load() {
  log("Loading…");
  try {
    const r = await fetch(API); const d = await r.json();
    if (!r.ok) throw new Error(d.error || r.status);
    state = d; render(); log("");
  } catch (e) { log("Couldn't load: " + e.message); $("#pending").innerHTML = '<tr><td colspan="7" class="empty">' + esc(e.message) + '</td></tr>'; }
}

function cityOptions(sel) {
  return '<option value="">— pick city —</option>' + state.cities.map(c => '<option value="' + c.code + '"' + (c.code === sel ? " selected" : "") + ">" + esc(c.name) + "</option>").join("");
}

function ready(o) { const c = cityFor(o); return !o.processing && c && !o.issues.filter(i => !i.startsWith("City")).length; }
function cityFor(o) { const s = document.querySelector('select[data-id="' + o.id + '"]'); return s ? s.value : o.city_code; }

function render() {
  $("#auto").classList.toggle("on", !!state.auto);
  const p = state.pending;
  const readyN = p.filter(o => ready(o)).length;
  const total = p.reduce((s, o) => s + (o.cod || 0), 0);
  $("#summary").innerHTML = '<span class="pill">' + p.length + ' waiting</span><span class="pill">' + readyN + ' ready</span><span class="pill">' + (p.length - readyN) + ' need attention</span><span class="pill">COD ' + rs(total) + '</span>';
  $("#pending").innerHTML = p.length ? p.map(o => {
    const other = o.issues.filter(i => !i.startsWith("City"));
    const fuzzy = o.city_match && !["exact","alias","manual"].includes(o.city_match);
    return '<tr data-row="' + o.id + '">' +
      '<td><input type="checkbox" class="sel" value="' + o.id + '"' + (o.processing ? " disabled" : "") + '></td>' +
      '<td><b>' + esc(o.name) + '</b><div class="muted">' + when(o.createdAt) + '</div></td>' +
      '<td>' + esc(o.customer) + '<div class="muted">' + esc(o.phone) + '</div><div class="muted">' + esc(o.address) + '</div></td>' +
      '<td><select data-id="' + o.id + '" class="' + (o.city_code ? "" : "bad") + '">' + cityOptions(o.city_code) + '</select>' +
        '<div class="muted">typed: ' + esc(o.city_input) + (fuzzy ? ' · check' : '') + '</div></td>' +
      '<td class="num">' + rs(o.cod) + '</td>' +
      '<td>' + esc(o.products) + '<div class="muted">' + esc(o.payment) + '</div></td>' +
      '<td class="status">' + (o.processing ? '<span class="issue">Booking in progress</span>' : '') + (o.failed ? '<span class="issue">Last attempt failed</span>' : '') +
        other.map(i => '<span class="issue">' + esc(i) + '</span>').join(" ") + (!o.city_code ? '<span class="issue">Pick city</span>' : '') + '</td>' +
    '</tr>';
  }).join("") : '<tr><td colspan="7" class="empty">No unfulfilled orders waiting. </td></tr>';
  $("#booked").innerHTML = state.booked.length ? state.booked.map(b =>
    '<tr><td><b>' + esc(b.name) + '</b><div class="muted">' + when(b.createdAt) + '</div></td><td>' + esc(b.customer) + '</td>' +
    '<td>' + (b.cn ? '<a href="https://www.tcsexpress.com/track/' + b.cn + '" target="_blank" rel="noopener">' + b.cn + '</a>' : '—') + '</td>' +
    '<td>' + esc(String(b.fulfillment || "").toLowerCase()) + '</td>' +
    '<td>' + (b.cn ? '<a href="/label/' + encodeURIComponent(KEY) + '/' + b.cn + '" target="_blank">PDF</a>' : '') + '</td></tr>').join("")
    : '<tr><td colspan="5" class="empty">Nothing booked from here yet.</td></tr>';
  document.querySelectorAll("select[data-id]").forEach(s => s.onchange = () => { s.classList.toggle("bad", !s.value); });
  document.querySelectorAll(".sel").forEach(c => c.onchange = updateSel);
  updateSel();
}

function updateSel() { $("#pushSel").disabled = !document.querySelectorAll(".sel:checked").length; }
$("#all").onchange = (e) => { document.querySelectorAll(".sel:not(:disabled)").forEach(c => c.checked = e.target.checked); updateSel(); };

async function push(ids) {
  if (!ids.length) return;
  if (!confirm("Book " + ids.length + " order(s) on TCS and mark them fulfilled in Shopify? Customers will get a tracking message.")) return;
  ["#pushSel","#pushAll","#refresh"].forEach(s => $(s).disabled = true);
  let ok = 0, fail = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]; const o = state.pending.find(x => x.id === id);
    log("Booking " + (i + 1) + " of " + ids.length + " — " + (o ? o.name : id) + "…");
    const cell = document.querySelector('tr[data-row="' + id + '"] .status');
    try {
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "push", id, city_code: cityFor(o) }) });
      const d = await r.json();
      if (d.ok) { ok++; if (cell) cell.innerHTML = '<span class="res-ok">' + (d.cn ? "CN " + d.cn : esc(d.skipped || "Done")) + '</span>' + (d.warning ? ' <span class="issue">' + esc(d.warning) + '</span>' : ''); }
      else { fail++; if (cell) cell.innerHTML = '<span class="issue">' + esc(d.error || "Failed") + '</span>'; }
    } catch (e) { fail++; if (cell) cell.innerHTML = '<span class="issue">' + esc(e.message) + '</span>'; }
  }
  log("Done: " + ok + " booked" + (fail ? ", " + fail + " failed (see red notes)" : "") + ". Refreshing…");
  ["#pushSel","#pushAll","#refresh"].forEach(s => $(s).disabled = false);
  setTimeout(load, fail ? 4000 : 1500);
}

$("#pushSel").onclick = () => push([...document.querySelectorAll(".sel:checked")].map(c => c.value));
$("#pushAll").onclick = () => push(state.pending.filter(o => ready(o)).map(o => o.id));
$("#refresh").onclick = load;
$("#auto").onclick = async () => {
  const want = !state.auto;
  if (want && !confirm("Turn on auto-booking? Every new Shopify order will be booked on TCS and fulfilled automatically. Orders with a missing phone or unknown city will still wait here.")) return;
  log("Saving…");
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "auto", value: want }) });
  const d = await r.json();
  if (!r.ok) return log("Couldn't change auto mode: " + d.error);
  state.auto = d.auto; render(); log(d.auto ? "Auto-booking is ON." : "Auto-booking is OFF.");
};
load();
</script>
</body></html>`;
