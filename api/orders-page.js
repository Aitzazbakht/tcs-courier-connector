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

// String.raw keeps backslashes in the browser script exactly as written.
const PAGE = String.raw`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>TCS Orders</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#F2F4F3; --surface:#FFFFFF; --ink:#1C2826; --mute:#67736F; --line:#DCE2DF; --soft:#EAEEEC;
  --pine:#2E6A4E; --pine-ink:#FFFFFF; --pine-soft:#E3EFE8;
  --rust:#B0502A; --rust-soft:#FBEDE6;
  --house:#1F5F8B; --house-soft:#E2EEF6; --herbs:#8A5A12; --herbs-soft:#F7EDD9;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#121816; --surface:#1A2220; --ink:#E6ECE9; --mute:#93A09B; --line:#2C3633; --soft:#222B29;
  --pine:#6FC39A; --pine-ink:#0D1A14; --pine-soft:#1C3229;
  --rust:#F0946B; --rust-soft:#33221A;
  --house:#8CC4EA; --house-soft:#1A2B37; --herbs:#E5BE7A; --herbs-soft:#33291A;
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
button,input,select{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--pine);outline-offset:2px}
a{color:var(--pine)}
.wrap{max-width:1240px;margin:0 auto;padding:0 20px}

/* header */
header{background:var(--surface);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}
.bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 0 10px}
.brand{font-weight:800;font-size:17px;letter-spacing:-.01em;margin-right:auto}
.brand span{color:var(--mute);font-weight:500;font-size:13px;margin-left:8px}
.ctrl{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;padding:5px 6px 5px 12px;background:var(--surface);cursor:pointer;white-space:nowrap}
.ctrl:hover{border-color:var(--mute)}
.switch{width:34px;height:20px;border-radius:999px;background:var(--line);position:relative;transition:background .15s;flex:none}
.switch::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s}
.ctrl[aria-checked="true"] .switch{background:var(--pine)}
.ctrl[aria-checked="true"] .switch::after{left:17px}
.btn{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:7px 12px;cursor:pointer;white-space:nowrap}
.btn:hover{border-color:var(--mute)}
.btn.primary{background:var(--pine);border-color:var(--pine);color:var(--pine-ink);font-weight:700}
.btn:disabled{opacity:.45;cursor:not-allowed}
.icon-btn{width:34px;height:34px;padding:0;display:grid;place-items:center;border-radius:50%}

/* tabs — the one bold element */
nav.tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin-bottom:-1px}
nav.tabs::-webkit-scrollbar{display:none}
.tab{border:0;background:none;padding:10px 16px 12px;cursor:pointer;color:var(--mute);border-bottom:3px solid transparent;display:flex;align-items:baseline;gap:10px;white-space:nowrap;font-weight:600}
.tab b{font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-.02em;line-height:1}
.tab[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--pine)}
.tab[aria-selected="true"] b{color:var(--pine)}
.tab.alert b{color:var(--rust)}

#log{min-height:20px;font-size:13px;color:var(--mute);padding:8px 0 0}

/* WhatsApp setup popover */
#waPanel{display:none;position:absolute;right:20px;top:58px;width:min(380px,calc(100vw - 40px));background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;box-shadow:0 12px 32px rgba(28,40,38,.14);z-index:20}
#waPanel.open{display:block}
#waPanel h3{margin:0 0 4px;font-size:15px}
#waPanel p{margin:0 0 12px;color:var(--mute);font-size:13px}
#waPanel .row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
#waPanel input{border:1px solid var(--line);border-radius:8px;padding:7px 10px;width:130px;background:var(--surface)}
#waOut{white-space:pre-wrap;font-size:12px;color:var(--mute);margin:8px 0 0;max-height:220px;overflow:auto}

/* panels */
main{padding:18px 0 40px}
.panel[hidden]{display:none}
.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.stats{margin-right:auto;color:var(--mute)}
.stats strong{color:var(--ink);font-weight:700}
.check{display:flex;align-items:center;gap:6px;color:var(--mute);cursor:pointer;white-space:nowrap}
.sheet{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:920px}
th{font-size:12px;font-weight:600;color:var(--mute);text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--surface)}
td{padding:11px 12px;border-bottom:1px solid var(--soft);vertical-align:top}
tr:last-child td{border-bottom:0}
tbody tr:hover td{background:color-mix(in srgb,var(--soft) 45%,transparent)}
.num{text-align:right;white-space:nowrap}
.sub{color:var(--mute);font-size:12.5px}
.order{font-weight:700}
.empty{padding:48px 16px;text-align:center;color:var(--mute)}
.note{color:var(--mute);font-size:13px;margin:0 0 12px}

.badge{display:inline-block;white-space:nowrap;font-size:11px;font-weight:700;border-radius:5px;padding:1px 6px;margin-left:6px;vertical-align:1px}
.store-house{background:var(--house-soft);color:var(--house)}
.store-herbs{background:var(--herbs-soft);color:var(--herbs)}
.chip{display:inline-block;font-size:12px;font-weight:600;border-radius:6px;padding:2px 7px;margin:0 4px 4px 0}
.chip.ok{background:var(--pine);color:var(--pine-ink);font-weight:700}
.chip.bad{background:var(--rust-soft);color:var(--rust)}
.chip.wait{background:var(--soft);color:var(--mute)}
.flag{color:var(--rust);font-weight:700;font-size:12px}
.prepaid{color:var(--pine);font-weight:700;font-size:12px}
.link{border:0;background:none;color:var(--pine);padding:0;font-size:12.5px;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.link.danger{color:var(--mute);margin-top:6px;font-weight:500;font-size:12px}
.link.danger:hover{color:var(--rust)}
.link:disabled{opacity:.5;cursor:default}
select{max-width:180px;padding:5px 6px;border:1px solid var(--line);border-radius:7px;background:var(--surface)}
select.bad,select.fuzzy{border:2px solid var(--rust)}

@media (max-width:640px){
  .wrap{padding:0 14px}
  .brand span{display:none}
  .tab{padding:10px 12px 12px}
  .tab b{font-size:19px}
  #waPanel{right:14px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head>
<body>
<header><div class="wrap" style="position:relative">
  <div class="bar">
    <div class="brand">TCS Orders<span id="storeNames">Chitral House</span></div>
    <button class="ctrl" id="waSw" role="switch" aria-checked="false">WhatsApp messages <span class="switch"></span></button>
    <button class="ctrl" id="auto" role="switch" aria-checked="false">Auto-book <span class="switch"></span></button>
    <button class="ctrl" id="webSw" role="switch" aria-checked="true" title="Hide checkout on devices of fake buyers">Website blocking <span class="switch"></span></button>
    <button class="btn" id="waOpen" aria-expanded="false" aria-controls="waPanel">WhatsApp setup</button>
    <button class="btn icon-btn" id="refresh" title="Refresh" aria-label="Refresh">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
    </button>
  </div>
  <div id="waPanel" role="dialog" aria-label="WhatsApp setup">
    <h3>WhatsApp setup</h3>
    <p>Only needed when setting up or changing the WhatsApp number.</p>
    <div class="row"><button class="btn" id="waStatus">Check number status</button><button class="btn" id="waTpl">Check templates</button></div>
    <div class="row"><button class="btn" id="waTplNew">Submit new templates</button><button class="btn" id="codFix">Fix "Rs 0" messages</button></div>
    <div class="row"><input id="waPin" type="password" inputmode="numeric" maxlength="6" placeholder="6-digit PIN"><button class="btn primary" id="waReg">Register number</button></div>
    <pre id="waOut"></pre>
  </div>
  <nav class="tabs" role="tablist">
    <button class="tab" role="tab" data-tab="waiting" aria-selected="true">Waiting to book <b id="cWaiting">–</b></button>
    <button class="tab" role="tab" data-tab="problems" aria-selected="false">Delivery problems <b id="cProblems">–</b></button>
    <button class="tab" role="tab" data-tab="booked" aria-selected="false">Booked, last 2 days <b id="cBooked">–</b></button>
    <button class="tab" role="tab" data-tab="blocked" aria-selected="false">Blocked <b id="cBlocked">–</b></button>
  </nav>
</div></header>

<main class="wrap">
  <div id="log" aria-live="polite"></div>

  <section class="panel" id="p-waiting">
    <div class="toolbar">
      <div class="stats" id="summary"></div>
      <label class="check" id="onlyConfWrap" hidden><input type="checkbox" id="onlyConf" checked> Only confirmed</label>
      <button class="btn" id="pushSel" disabled>Push selected</button>
      <button class="btn primary" id="pushAll">Push all ready</button>
    </div>
    <div class="sheet"><div class="scroll"><table>
      <thead><tr><th style="width:34px"><input type="checkbox" id="all" aria-label="Select all"></th><th>Order</th><th>Customer</th><th>City</th><th class="num">COD</th><th>Products</th><th>Status</th></tr></thead>
      <tbody id="pending"><tr><td colspan="7" class="empty">Loading orders…</td></tr></tbody>
    </table></div></div>
  </section>

  <section class="panel" id="p-problems" hidden>
    <p class="note">TCS couldn't deliver these parcels (refused, nobody home, address not found). Call the customer or TCS, then mark it done.</p>
    <div class="sheet"><div class="scroll"><table>
      <thead><tr><th>Order</th><th>Customer</th><th>CN</th><th>TCS latest update</th><th>Customer reply</th><th></th></tr></thead>
      <tbody id="problems"><tr><td colspan="6" class="empty">Loading…</td></tr></tbody>
    </table></div></div>
  </section>

  <section class="panel" id="p-booked" hidden>
    <p class="note">Orders sent to TCS in the last 2 days. Older bookings are in the TCS portal.</p>
    <div class="sheet"><div class="scroll"><table>
      <thead><tr><th>Order</th><th>Customer</th><th>CN</th><th>Booked</th><th>Label</th></tr></thead>
      <tbody id="booked"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody>
    </table></div></div>
  </section>
  <section class="panel" id="p-blocked" hidden>
    <div class="toolbar">
      <p class="note" style="margin:0;margin-right:auto">Devices that placed a fake order. On these devices the website shows "Order on WhatsApp" instead of Buy now and Checkout.</p>
      <input id="blkSearch" type="search" placeholder="Search order, name or phone" aria-label="Search blocked" style="border:1px solid var(--line);border-radius:8px;padding:7px 10px;min-width:220px;background:var(--surface)">
    </div>
    <div class="sheet"><div class="scroll"><table>
      <thead><tr><th>Order</th><th>Customer</th><th>Blocked on</th><th>Blocked visits</th><th></th></tr></thead>
      <tbody id="blocked"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody>
    </table></div></div>
  </section>
</main>

<script>
const KEY = __KEY__;
const API = "/api/orders?key=" + encodeURIComponent(KEY);
let state = { pending: [], booked: [], cities: [], auto: false, waOn: false, stores: [] };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const log = (m) => { $("#log").textContent = m || ""; };
const rs = (n) => "Rs " + Number(n || 0).toLocaleString("en-PK");
const when = (d) => d ? new Date(d).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const post = (body) => fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || r.status); return d; });

/* ---------- tabs ---------- */
function showTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
  document.querySelectorAll(".panel").forEach(p => p.hidden = p.id !== "p-" + name);
  try { history.replaceState(null, "", "#" + name); } catch (e) {}
}
document.querySelectorAll(".tab").forEach(t => t.onclick = () => showTab(t.dataset.tab));
showTab(["waiting", "problems", "booked", "blocked"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "waiting");

/* ---------- WhatsApp setup popover ---------- */
$("#waOpen").onclick = (e) => { e.stopPropagation(); const open = $("#waPanel").classList.toggle("open"); $("#waOpen").setAttribute("aria-expanded", String(open)); };
document.addEventListener("click", (e) => { if (!$("#waPanel").contains(e.target) && e.target !== $("#waOpen")) { $("#waPanel").classList.remove("open"); $("#waOpen").setAttribute("aria-expanded", "false"); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#waPanel").classList.remove("open"); });
async function waCall(body, fmt) {
  $("#waOut").textContent = "Working…";
  try { const d = await post(body); $("#waOut").textContent = fmt ? fmt(d) : JSON.stringify(d.phone || d, null, 2); }
  catch (e) { $("#waOut").textContent = "Couldn't complete: " + e.message; }
}
$("#waStatus").onclick = () => waCall({ action: "wa_status" }, (d) => {
  const p = d.phone || {};
  return [p.verified_name + "  " + p.display_phone_number, "Status: " + p.status, "Display name: " + p.name_status, "Quality: " + p.quality_rating].join("\n");
});
$("#waTpl").onclick = () => waCall({ action: "wa_templates" }, (d) => (d.templates || []).filter(t => t.name.startsWith("ch_")).map(t => t.name + ": " + t.status).join("\n"));
$("#waTplNew").onclick = () => waCall({ action: "wa_templates_create" }, (d) => (d.templates || []).map(t => t.name + ": " + (t.ok ? "submitted (" + (t.status || "pending") + ")" : /exist|duplicate|already/i.test(t.error) ? "already exists" : t.error)).join("\n"));
$("#codFix").onclick = async () => {
  $("#waOut").textContent = "Checking…";
  try {
    const d = await post({ action: "cod_fix" });
    const list = d.rows.map(r => r.error ? r.store + ": " + r.error : r.name + " " + r.customer + " · Rs " + r.cod.toLocaleString("en-PK") + " · " + r.action).join("\n");
    $("#waOut").textContent = d.affected + " customer(s) got the wrong Rs 0 message.\n" + list;
    if (!d.toSend) return;
    if (!confirm("Send the correction message to " + d.toSend + " customer(s) with the correct COD amount?")) return;
    $("#waOut").textContent = "Sending…";
    const r = await post({ action: "cod_fix", send: true });
    $("#waOut").textContent = r.rows.map(x => x.error ? x.store + ": " + x.error : x.name + " " + x.customer + " · Rs " + x.cod.toLocaleString("en-PK") + " · " + x.action).join("\n");
  } catch (e) { $("#waOut").textContent = "Couldn't complete: " + e.message; }
};
$("#waReg").onclick = () => {
  const pin = $("#waPin").value.trim();
  if (!/^\d{6}$/.test(pin)) return ($("#waOut").textContent = "Enter the 6-digit PIN.");
  $("#waPin").value = "";
  waCall({ action: "wa_register", pin }, (d) => d.register ? "Number registered." : JSON.stringify(d, null, 2));
};

/* ---------- switches ---------- */
function setSwitch(el, on) { el.setAttribute("aria-checked", String(!!on)); }
$("#waSw").onclick = async () => {
  const want = !state.waOn;
  if (want && !confirm("Turn on WhatsApp messages? Customers get order confirmations, dispatch updates and delivery updates.")) return;
  try { const d = await post({ action: "wa_toggle", value: want }); state.waOn = d.waOn; renderWaiting(); log(d.waOn ? "WhatsApp messages turned on." : "WhatsApp messages turned off."); }
  catch (e) { log("Couldn't change WhatsApp messages: " + e.message); }
};
$("#auto").onclick = async () => {
  const want = !state.auto;
  if (want && !confirm("Turn on auto-book? New orders are booked on TCS automatically" + (state.waOn ? " once the customer confirms on WhatsApp." : " as soon as they come in."))) return;
  try { const d = await post({ action: "auto", value: want }); state.auto = d.auto; renderWaiting(); log(d.auto ? "Auto-book turned on." : "Auto-book turned off."); }
  catch (e) { log("Couldn't change auto-book: " + e.message); }
};

$("#webSw").onclick = async () => {
  const want = !state.webBlock;
  if (!want && !confirm("Turn off website blocking? Blocked devices will be able to check out again until you turn it back on.")) return;
  try { const d = await post({ action: "web_block", value: want }); state.webBlock = d.webBlock; setSwitch($("#webSw"), d.webBlock); log(d.webBlock ? "Website blocking turned on." : "Website blocking turned off. Nobody is blocked on the website now."); }
  catch (e) { log("Couldn't change website blocking: " + e.message); }
};

/* ---------- waiting to book ---------- */
const cityVal = (code, name) => code ? code + "|" + name : "";
function cityOptions(sel) {
  return '<option value="">Pick city</option>' + state.cities.map(c => { const v = cityVal(c.code, c.name); return '<option value="' + esc(v) + '"' + (v === sel ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("");
}
function cityFor(o) { const s = document.querySelector('select[data-id="' + CSS.escape(o.id) + '"]'); return s ? s.value : cityVal(o.city_code, o.city_name); }
function ready(o) {
  if (o.processing || !cityFor(o) || o.issues.filter(i => !i.startsWith("City")).length) return false;
  if (o.wa === "cancelled") return false;
  if (state.waOn && $("#onlyConf").checked && o.wa !== "confirmed") return false;
  return true;
}
function storeBadge(o) {
  if (!state.stores || state.stores.length < 2 || !o.store) return "";
  return '<span class="badge store-' + esc(o.store) + '">' + esc(o.storeLabel || o.store) + "</span>";
}
function waChip(o) {
  if (o.wa === "confirmed") return '<span class="chip ok">Confirmed</span>';
  if (o.wa === "cancelled") return '<span class="chip bad">Customer cancelled</span>';
  if (o.wa === "sent") return '<span class="chip wait">Awaiting reply</span>';
  return state.waOn ? '<button class="link" data-conf="' + esc(o.id) + '">Send confirmation</button>' : "";
}
function renderWaiting() {
  setSwitch($("#auto"), state.auto); setSwitch($("#waSw"), state.waOn);
  $("#onlyConfWrap").hidden = !state.waOn;
  const p = state.pending;
  const readyN = p.filter(ready).length;
  const cod = p.reduce((s, o) => s + (o.cod || 0), 0);
  $("#cWaiting").textContent = p.length;
  $("#summary").innerHTML = "<strong>" + readyN + "</strong> ready to push · " + (p.length - readyN) + " waiting on confirmation or details · " + rs(cod) + " COD";
  $("#pending").innerHTML = p.length ? p.map(o => {
    const other = o.issues.filter(i => !i.startsWith("City"));
    const fuzzy = o.city_match && !["exact", "alias", "manual"].includes(o.city_match);
    return '<tr data-row="' + esc(o.id) + '">' +
      '<td><input type="checkbox" class="sel" value="' + esc(o.id) + '"' + (o.processing ? " disabled" : "") + ' aria-label="Select ' + esc(o.name) + '"></td>' +
      '<td><span class="order">' + esc(o.name) + "</span>" + storeBadge(o) + '<div class="sub">' + when(o.createdAt) + "</div></td>" +
      "<td>" + esc(o.customer) + '<div class="sub">' + esc(o.phone) + '</div><div class="sub">' + esc(o.address) + "</div></td>" +
      '<td><select data-id="' + esc(o.id) + '" class="' + (o.city_code ? (fuzzy ? "fuzzy" : "") : "bad") + '" aria-label="TCS city">' + cityOptions(cityVal(o.city_code, o.city_name)) + "</select>" +
        '<div class="sub">Typed: ' + esc(o.city_input) + (fuzzy ? ' <span class="flag">Check city</span>' : "") + "</div></td>" +
      '<td class="num">' + (o.prepaid ? '<span class="prepaid">Prepaid</span>' : rs(o.cod)) + "</td>" +
      "<td>" + esc(o.products) + '<div class="sub">' + esc(o.payment) + "</div></td>" +
      '<td class="status">' + waChip(o) +
        (o.processing ? '<span class="chip wait">Booking…</span>' : "") + (o.failed ? '<span class="chip bad">Last push failed</span>' : "") +
        other.map(i => '<span class="chip bad">' + esc(i) + "</span>").join("") + (!o.city_code ? '<span class="chip bad">Pick city</span>' : "") +
        (o.processing || o.wa === "confirmed" ? "" : '<div><button class="link danger" data-cancel="' + esc(o.id) + '" data-name="' + esc(o.name) + '">Cancel &amp; restock</button></div>') + "</td>" +
      "</tr>";
  }).join("") : '<tr><td colspan="7" class="empty">No orders waiting. New orders from your stores appear here.</td></tr>';
  document.querySelectorAll("select[data-id]").forEach(s => s.onchange = () => { s.classList.toggle("bad", !s.value); s.classList.remove("fuzzy"); const f = s.parentElement.querySelector(".flag"); if (f) f.remove(); renderSummaryOnly(); });
  document.querySelectorAll(".sel").forEach(c => c.onchange = updateSel);
  document.querySelectorAll("[data-conf]").forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = "Sending…";
    try { const d = await post({ action: "wa_confirm_send", id: b.dataset.conf }); b.outerHTML = d.sent ? '<span class="chip wait">Awaiting reply</span>' : '<span class="chip bad">' + esc(d.error || d.skipped || "Not sent") + "</span>"; }
    catch (e) { b.textContent = "Couldn't send: " + e.message; }
  });
  document.querySelectorAll("[data-cancel]").forEach(b => b.onclick = async () => {
    if (!confirm("Cancel order " + b.dataset.name + " as a FAKE order?\n\nStock goes back to inventory, the customer is not emailed, and this can't be undone.")) return;
    b.disabled = true; b.textContent = "Cancelling…";
    try {
      const d = await post({ action: "cancel_fake", id: b.dataset.cancel });
      if (!d.ok) throw new Error(d.error || "Not cancelled");
      state.pending = state.pending.filter(x => x.id !== b.dataset.cancel);
      renderWaiting();
      const blk = d.block && d.block.blocked ? " Their device is now blocked on the website." : "";
      log("Order " + (d.name || b.dataset.name) + " cancelled as fake order and restocked." + blk);
      if (blk) post({ action: "blocked_list" }).then(r => { state.blocked = r.rows; renderBlocked(); }).catch(() => {});
    } catch (e) { b.disabled = false; b.textContent = "Cancel & restock"; log("Couldn't cancel " + b.dataset.name + ": " + e.message); }
  });
  updateSel();
}
function renderSummaryOnly() {
  const p = state.pending; const readyN = p.filter(ready).length; const cod = p.reduce((s, o) => s + (o.cod || 0), 0);
  $("#summary").innerHTML = "<strong>" + readyN + "</strong> ready to push · " + (p.length - readyN) + " waiting on confirmation or details · " + rs(cod) + " COD";
}
$("#onlyConf").onchange = renderSummaryOnly;
function updateSel() { $("#pushSel").disabled = !document.querySelectorAll(".sel:checked").length; }
$("#all").onchange = (e) => { document.querySelectorAll(".sel:not(:disabled)").forEach(c => c.checked = e.target.checked); updateSel(); };

async function push(ids) {
  if (!ids.length) return log("Nothing ready to push.");
  if (!confirm("Book " + ids.length + " order(s) on TCS? They'll be marked fulfilled and paid in Shopify, and customers get their tracking number.")) return;
  ["#pushSel", "#pushAll", "#refresh"].forEach(s => $(s).disabled = true);
  let ok = 0, fail = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]; const o = state.pending.find(x => x.id === id);
    log("Booking " + (i + 1) + " of " + ids.length + ": " + (o ? o.name : id));
    const cell = document.querySelector('tr[data-row="' + CSS.escape(id) + '"] .status');
    try {
      const d = await post({ action: "push", id, city: cityFor(o) });
      if (d.ok) { ok++; if (cell) cell.innerHTML = '<span class="chip ok">' + (d.cn ? "Booked · CN " + esc(d.cn) : esc(d.skipped || "Done")) + "</span>" + (d.warning ? '<span class="chip bad">' + esc(d.warning) + "</span>" : ""); }
      else { fail++; if (cell) cell.innerHTML = '<span class="chip bad">' + esc(d.error || "Failed") + "</span>"; }
    } catch (e) { fail++; if (cell) cell.innerHTML = '<span class="chip bad">' + esc(e.message) + "</span>"; }
  }
  log(ok + " booked" + (fail ? ", " + fail + " failed (see the red notes)" : "") + ". Refreshing…");
  ["#pushSel", "#pushAll", "#refresh"].forEach(s => $(s).disabled = false);
  setTimeout(loadAll, fail ? 4000 : 1500);
}
$("#pushSel").onclick = () => push([...document.querySelectorAll(".sel:checked")].map(c => c.value));
$("#pushAll").onclick = () => push(state.pending.filter(ready).map(o => o.id));

/* ---------- booked (last 2 days) ---------- */
function renderBooked() {
  const b = state.booked || [];
  $("#cBooked").textContent = b.length;
  $("#booked").innerHTML = b.length ? b.map(x =>
    '<tr><td><span class="order">' + esc(x.name) + "</span>" + storeBadge(x) + "</td>" +
    "<td>" + esc(x.customer) + '<div class="sub">' + esc(x.city) + "</div></td>" +
    "<td>" + (x.cn ? '<a href="https://www.tcsexpress.com/track/' + esc(x.cn) + '" target="_blank" rel="noopener">' + esc(x.cn) + "</a>" : "–") + "</td>" +
    "<td>" + when(x.bookedAt) + "</td>" +
    "<td>" + (x.cn ? '<a href="/label/' + encodeURIComponent(KEY) + "/" + esc(x.cn) + '" target="_blank">Print label</a>' : "") + "</td></tr>").join("")
    : '<tr><td colspan="5" class="empty">Nothing booked in the last 2 days.</td></tr>';
}

/* ---------- blocked devices ---------- */
function renderBlocked() {
  const all = state.blocked || [];
  $("#cBlocked").textContent = all.length;
  setSwitch($("#webSw"), state.webBlock !== false);
  const q = ($("#blkSearch").value || "").toLowerCase().replace(/[\s#-]/g, "");
  const qd = q.replace(/\D/g, "").replace(/^(92|0)/, "");
  const rows = q ? all.filter(x => (x.order + x.name + x.phone + x.city).toLowerCase().replace(/[\s#-]/g, "").includes(q)
    || (qd.length >= 6 && String(x.phone).replace(/\D/g, "").includes(qd))) : all;
  $("#blocked").innerHTML = rows.length ? rows.map(x =>
    '<tr><td><span class="order">' + esc(x.order) + "</span>" + storeBadge({ store: x.store, storeLabel: x.storeLabel }) +
      '<div class="sub">' + (x.ids.length > 1 ? x.ids.length + " devices" : "1 device") + "</div></td>" +
    "<td>" + esc(x.name) + '<div class="sub">' + esc(x.phone) + (x.city ? " · " + esc(x.city) : "") + "</div></td>" +
    "<td>" + when(x.at) + "</td>" +
    "<td>" + (x.hits || 0) + (x.last ? '<div class="sub">last ' + when(x.last) + "</div>" : "") + "</td>" +
    '<td><button class="btn" data-unblock="' + esc(x.key) + '">Unblock</button></td></tr>').join("")
    : '<tr><td colspan="5" class="empty">' + (q ? "No blocked device matches your search." : "No blocked devices. When you cancel a fake website order, its device appears here.") + "</td></tr>";
  document.querySelectorAll("[data-unblock]").forEach(b => b.onclick = async () => {
    const x = all.find(r => r.key === b.dataset.unblock); if (!x) return;
    if (!confirm("Unblock " + x.name + " (" + x.order + ")? They can check out on the website again.")) return;
    b.disabled = true;
    try { await post({ action: "unblock", ids: x.ids }); state.blocked = all.filter(r => r !== x); renderBlocked(); log(x.order + " unblocked."); }
    catch (e) { b.disabled = false; log("Couldn't unblock: " + e.message); }
  });
}
$("#blkSearch").oninput = renderBlocked;

/* ---------- delivery problems ---------- */
async function loadProblems() {
  try {
    const d = await post({ action: "problems" });
    const list = (d.problems || []).filter(p => !p.error);
    $("#cProblems").textContent = list.length;
    document.querySelector('.tab[data-tab="problems"]').classList.toggle("alert", list.length > 0);
    const reply = (p) => p.reply === "retry" ? '<span class="chip ok">Wants delivery again</span>'
      : p.reply === "cancel" ? '<span class="chip bad">Wants to cancel</span>'
      : p.reply === "asked" ? '<span class="chip wait">Asked, no reply</span>' : '<span class="sub">Not messaged</span>';
    $("#problems").innerHTML = list.length ? list.map(p =>
      '<tr><td><span class="order">' + esc(p.name) + "</span>" + storeBadge(p) + '<div class="sub">' + esc(p.city) + " · Rs " + esc(p.cod) + "</div></td>" +
      "<td>" + esc(p.customer) + '<div class="sub"><a href="tel:' + esc(p.phone) + '">' + esc(p.phone) + "</a></div></td>" +
      '<td><a href="https://www.tcsexpress.com/track/' + esc(p.cn) + '" target="_blank" rel="noopener">' + esc(p.cn) + "</a></td>" +
      "<td>" + esc(p.status) + '<div class="sub">' + esc(p.when) + "</div></td>" +
      "<td>" + reply(p) + "</td>" +
      '<td><button class="btn" data-handled="' + esc(p.id) + '">Mark done</button></td></tr>').join("")
      : '<tr><td colspan="6" class="empty">No delivery problems right now.</td></tr>';
    document.querySelectorAll("[data-handled]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await post({ action: "problem_handled", id: b.dataset.handled }); b.closest("tr").remove(); $("#cProblems").textContent = Math.max(0, Number($("#cProblems").textContent) - 1); }
      catch (e) { b.disabled = false; log("Couldn't mark done: " + e.message); }
    });
  } catch (e) { $("#problems").innerHTML = '<tr><td colspan="6" class="empty">Couldn\'t load delivery problems: ' + esc(e.message) + "</td></tr>"; }
}

/* ---------- load ---------- */
async function load() {
  try {
    const r = await fetch(API); const d = await r.json();
    if (!r.ok) throw new Error(d.error || r.status);
    state = d;
    $("#storeNames").textContent = (d.stores || []).join(" + ");
    renderWaiting(); renderBooked(); renderBlocked();
    log((d.storeErrors || []).map(e => e.store + ": " + e.error).join("  ·  "));
  } catch (e) {
    log("Couldn't load orders: " + e.message);
    $("#pending").innerHTML = '<tr><td colspan="7" class="empty">Couldn\'t load orders. Check your connection and refresh.</td></tr>';
  }
}
function loadAll() { load(); loadProblems(); }
$("#refresh").onclick = loadAll;
loadAll();
</script>
</body></html>`;
