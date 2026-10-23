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

/* delivery report */
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:14px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.card .k{font-size:12px;color:var(--mute);font-weight:600}
.card .v{font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.25}
.card .s{font-size:12.5px;color:var(--mute)}
.card.main{border-color:var(--pine)}
.card.main .v{color:var(--pine)}
.card.ret .v{color:var(--rust)}
.field{display:flex;align-items:center;gap:6px;color:var(--mute);white-space:nowrap}
.field input[type=date],.field input[type=search]{border:1px solid var(--line);border-radius:8px;padding:6px 9px;background:var(--surface);color:var(--ink)}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:9px;background:var(--surface);overflow:hidden}
.seg button{border:0;background:transparent;color:var(--mute);padding:7px 12px;cursor:pointer;white-space:nowrap;font:inherit;border-right:1px solid var(--line)}
.seg button:last-child{border-right:0}
.seg button:hover{color:var(--ink);background:var(--soft)}
.seg button.on{background:var(--pine-soft);color:var(--pine);font-weight:700}
.field select{border:1px solid var(--line);border-radius:8px;padding:6px 9px;background:var(--surface);color:var(--ink);font:inherit}
.mkcards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.mkcard{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px;text-align:left;font:inherit;color:inherit}
.mkcard.click{cursor:pointer}.mkcard.click:hover{border-color:var(--pine)}.mkcard.on{border-color:var(--pine);background:var(--pine-soft)}
.mkcard .v{font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.25}.mkcard .s{font-size:12.5px;color:var(--mute)}
#mkTable td.n,#mkTable th.n{text-align:right;white-space:nowrap}
#mkTable{min-width:760px}
.daterange{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--pine);border-radius:9px;background:var(--surface);padding:3px 4px 3px 10px}
.daterange input[type=date]{border:0;background:transparent;color:var(--ink);font:inherit;padding:4px 2px;outline:0}
.daterange .arr{color:var(--mute)}
.daterange:focus-within{box-shadow:0 0 0 3px var(--pine-soft)}
@media (max-width:560px){.seg{width:100%}.seg button{flex:1;padding:7px 6px}.daterange{width:100%;justify-content:space-between}}
.ratiobox{background:var(--pine-soft);border:1px solid var(--pine);border-radius:14px;padding:16px 20px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-bottom:14px}
.ratiobox .big{font-size:44px;font-weight:800;color:var(--pine);line-height:1}
.ratiobox p{margin:0;flex:1;min-width:220px}
.tgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px}
@media (max-width:820px){.tgrid{grid-template-columns:minmax(0,1fr)}}
.tbox{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;min-width:0}
.tbox h3{margin:0 0 8px;font-size:14px}
.tbox table,.lst table{min-width:0;width:100%;border-collapse:collapse;font-size:13px}
.tbox td,.tbox th{padding:5px 6px;border-bottom:1px solid var(--line);text-align:left}
.tbox th{color:var(--mute);font-weight:600}
.tbox td.n,.tbox th.n{text-align:right;white-space:nowrap}
.tbox tr.sum td{font-weight:800;border-bottom:0}
.tbox .sub{font-size:12px}
.lst details{background:var(--surface);border:1px solid var(--line);border-radius:12px;margin-bottom:8px;padding:8px 14px}
.lst summary{cursor:pointer;font-weight:700}
.lst table{min-width:0;width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}
.lst td{padding:5px 6px;border-top:1px solid var(--line);vertical-align:top}
.lst td.n{text-align:right;white-space:nowrap}
.btn.on{background:var(--pine-soft);border-color:var(--pine);font-weight:700}
.t-sm{min-width:1000px}
th[data-sort]{cursor:pointer;user-select:none;white-space:nowrap}
th[data-sort]:hover{color:var(--ink)}
.meter{height:6px;background:var(--soft);border-radius:3px;margin-top:5px;overflow:hidden;min-width:90px}
.meter i{display:block;height:100%;background:var(--pine)}
.charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:14px}
.chart{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;min-width:0}
.chart h3{margin:0;font-size:14px;font-weight:700}
.chart .cap{margin:2px 0 12px;color:var(--mute);font-size:12.5px}
.donutwrap{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
.donutwrap svg{flex:none}
.legend{display:grid;gap:9px;font-size:13px;flex:1;min-width:150px}
.legend div{display:flex;align-items:center;gap:8px}
.legend i{width:10px;height:10px;border-radius:3px;flex:none}
.legend b{margin-left:auto;padding-left:14px;font-weight:700}
.legend .sub{min-width:46px;text-align:right}
.hb.sw{grid-template-columns:200px minmax(0,1fr) auto}
.hb{display:grid;grid-template-columns:104px minmax(0,1fr) auto;align-items:center;gap:10px;margin:8px 0;font-size:13px}
.hl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ht{position:relative;height:14px;background:var(--soft);border-radius:7px}
.ht>i{display:block;height:100%;border-radius:7px}
.ht .avg{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ink);opacity:.5;border-radius:1px}
.hv{white-space:nowrap;font-weight:700;min-width:96px;text-align:right}
.hv small{color:var(--mute);font-weight:500}
.stk{display:flex;height:14px;border-radius:7px;overflow:hidden;gap:1px}
.stk i{display:block;height:100%;min-width:2px}
.c-del{background:var(--pine)}.c-ret{background:var(--rust)}.c-pro{background:var(--house)}
.key{display:flex;gap:14px;flex-wrap:wrap;color:var(--mute);font-size:12px;margin-top:10px}
.key span{display:flex;align-items:center;gap:6px}
.key i{width:10px;height:10px;border-radius:3px}
.chart.wide{grid-column:1/-1}
.sv{width:100%;height:auto;display:block;overflow:visible}
.sv text{font-size:11px;fill:var(--mute)}
.sv .g{stroke:var(--line);stroke-width:1}
.f-bk{fill:var(--house)}.f-del{fill:var(--pine)}.f-ret{fill:var(--rust)}.f-pro{fill:#5b7fd6}
.sv rect:hover{opacity:.75}
@media (max-width:820px){.hb.sw{grid-template-columns:120px minmax(0,1fr) auto}.charts{grid-template-columns:minmax(0,1fr)}.hb{grid-template-columns:84px minmax(0,1fr) auto}}
#tip{position:fixed;z-index:60;max-width:300px;background:var(--ink);color:var(--surface);font-size:12.5px;line-height:1.45;font-weight:500;padding:8px 11px;border-radius:8px;pointer-events:none;opacity:0;transform:translateY(2px);transition:opacity .12s,transform .12s;box-shadow:0 6px 18px rgba(0,0,0,.18)}
#tip.on{opacity:1;transform:none}
[data-tip]{cursor:help}
button[data-tip],a[data-tip],select[data-tip],input[data-tip],label[data-tip],.tab[data-tip]{cursor:pointer}
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
    <button class="ctrl" id="webSw" role="switch" aria-checked="true">Website blocking <span class="switch"></span></button>
    <button class="btn" id="waOpen" aria-expanded="false" aria-controls="waPanel">WhatsApp setup</button>
    <button class="btn icon-btn" id="refresh" aria-label="Refresh">
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
    <button class="tab" role="tab" data-tab="abandoned" aria-selected="false">Abandoned carts <b id="cAband">–</b></button>
    <button class="tab" role="tab" data-tab="marketing" aria-selected="false">Marketing Workflow <b id="cMk">–</b></button>
    <button class="tab" role="tab" data-tab="blocked" aria-selected="false">Blocked <b id="cBlocked">–</b></button>
    <button class="tab" role="tab" data-tab="delivery" aria-selected="false">TCS delivery report <b id="cDelivery">–</b></button>
    <button class="tab" role="tab" data-tab="total" aria-selected="false">Total delivery report <b id="cTotal">–</b></button>
  </nav>
</div></header>

<main class="wrap">
  <div id="log" aria-live="polite"></div>

  <section class="panel" id="p-waiting">
    <div class="toolbar">
      <div class="stats" id="summary"></div>
      <select id="storeFilter" aria-label="Show orders from" hidden>
        <option value="all">All stores</option><option value="house">Chitral House</option><option value="herbs">Chitral Herbs</option>
      </select>
      <div class="seg" id="dateSeg" role="group" aria-label="Order date">
        <button type="button" data-d="all" class="on">All time</button><button type="button" data-d="today">Today</button><button type="button" data-d="7d">7 days</button><button type="button" data-d="30d">30 days</button><button type="button" data-d="custom">Custom</button>
      </div>
      <span class="daterange" id="dateCustom" hidden>
        <input type="date" id="wFrom" aria-label="From date"><span class="arr">→</span><input type="date" id="wTo" aria-label="To date">
      </span>
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
    <div class="toolbar">
      <label class="field">Status <select id="prStatus"><option value="">All statuses</option></select></label>
      <label class="field">Order date <input type="date" id="prDate"></label>
      <button class="btn on" id="prAll" data-tip="Show orders from every date.">All dates</button>
      <button class="btn" id="prRefresh" data-tip="Ask TCS again for every parcel instead of using the results saved in the last 15 minutes.">Refresh TCS status</button>
      <span class="stats" id="prMeta" style="margin-left:auto"></span>
    </div>
    <p class="note">Every parcel still in process with TCS (not delivered, not returned), from both stores. Call the customer or TCS, then press Mark done.</p>
    <div class="sheet"><div class="scroll"><table>
      <thead><tr><th>Order</th><th>Customer</th><th>CN</th><th>Status</th><th>Details</th><th>Customer reply</th><th></th></tr></thead>
      <tbody id="problems"><tr><td colspan="7" class="empty">Open this tab to load in-process parcels.</td></tr></tbody>
    </table></div></div>
  </section>

  <section class="panel" id="p-abandoned" hidden>
    <div class="toolbar">
      <label class="field">From <input type="date" id="abFrom"></label>
      <label class="field">To <input type="date" id="abTo"></label>
      <button class="btn primary" id="abRun">Show</button>
      <label class="field"><input type="checkbox" id="abHidden"> Show handled</label>
      <button class="btn primary" id="abAll" data-tip="Sends the 10% offer on WhatsApp to every customer below who has a mobile number and has not been messaged yet. Each one is marked done after the message is sent.">Send offer to all</button>
      <button class="btn" id="abTest" data-tip="Sends the 10% offer message for the first cart below to a phone number you type, so you can try the link yourself. Nothing is marked as sent.">Send a test</button>
      <span class="stats" id="abMeta" style="margin-left:auto"></span>
    </div>
    <p class="note">Customers who started checkout and left their name and a phone number or email, but did not order. Contact them, then press Mark done.</p>
    <div class="sheet"><div class="scroll"><table>
      <thead><tr><th>Customer</th><th>Contact</th><th>Cart</th><th>Left</th><th></th></tr></thead>
      <tbody id="abBody"><tr><td colspan="5" class="empty">Open this tab to load abandoned carts.</td></tr></tbody>
    </table></div></div>
    <div id="abStats" style="margin-top:14px"></div>
  </section>
  <section class="panel" id="p-marketing" hidden>
    <div class="toolbar">
      <label class="field">Load <select id="mkDays"><option value="0">All orders</option><option value="365">Last 12 months</option><option value="180">Last 6 months</option><option value="60">Last 2 months</option></select></label>
      <button class="btn primary" id="mkRefresh" data-tip="Asks Shopify for every order from both stores. It runs on Shopify's side and takes a few minutes for a large history. The result is kept in this browser so the tab opens instantly next time.">Refresh orders from Shopify</button>
      <button class="btn" id="mkCsv" disabled data-tip="Downloads what is shown below (all rows, not just the first page) as a spreadsheet file.">Download CSV</button>
      <span class="stats" id="mkMeta" style="margin-left:auto"></span>
    </div>
    <div class="toolbar">
      <div class="seg" id="mkView" role="group" aria-label="View"><button type="button" data-v="customers" class="on">Customers</button><button type="button" data-v="orders">Orders</button></div>
      <label class="field">Period <select id="mkPeriod">
        <option value="all">All time</option><option value="today">Today</option><option value="week">This week</option><option value="7d">Last 7 days</option>
        <option value="month">This month</option><option value="lastmonth">Last month</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="custom">Custom range</option></select></label>
      <span class="daterange" id="mkCustom" hidden><input type="date" id="mkFrom" aria-label="From date"><span class="arr">→</span><input type="date" id="mkTo" aria-label="To date"></span>
      <label class="field">Orders <select id="mkGroup"><option value="all">Any number</option><option value="1">Single (1)</option><option value="2">Double (2)</option><option value="3">3 or more</option></select></label>
      <label class="field">Sort <select id="mkSort"></select></label>
      <label class="field">Show <select id="mkLimit"><option value="0">All</option><option value="100">Top 100</option><option value="200">Top 200</option><option value="500">Top 500</option><option value="1000">Top 1000</option><option value="2000">Top 2000</option></select></label>
      <label class="field">Store <select id="mkStore"><option value="all">Both stores</option><option value="house">Chitral House</option><option value="herbs">Chitral Herbs</option></select></label>
      <label class="field">Offer <select id="mkOffer"><option value="all">Any</option><option value="none">Not sent yet</option><option value="sent">Already sent</option></select></label>
      <label class="field"><input type="search" id="mkSearch" placeholder="Search name, phone or order"></label>
    </div>
    <div class="toolbar" id="mkOfferBar">
      <label class="field">Daily limit <input type="number" id="mkCap" min="1" max="2000" value="1500" style="width:80px;border:1px solid var(--line);border-radius:8px;padding:6px 9px;background:var(--surface);color:var(--ink)"></label>
      <label class="field">Code valid for <select id="mkDays2"><option value="7">7 days</option><option value="14" selected>14 days</option><option value="30">30 days</option></select></label>
      <button class="btn primary" id="mkSend" data-tip="Sends each customer shown below (customers view) their own one-time 10% code on WhatsApp. Customers who already got an offer are skipped. Stops at the daily limit.">Send 10% offer to shown customers</button>
      <button class="btn" id="mkTest" data-tip="Sends the offer message for the first customer below to a phone number you type. Nothing is marked as sent.">Send a test</button>
      <button class="btn" id="mkResBtn" data-tip="Counts how many of the codes were used on an order.">Check results</button>
      <span class="stats" id="mkOfferMeta" style="margin-left:auto"></span>
    </div>
    <div id="mkResults" style="margin-bottom:12px"></div>
    <div class="mkcards" id="mkCards"></div>
    <div class="sheet"><div class="scroll"><table id="mkTable">
      <thead id="mkHead"></thead>
      <tbody id="mkBody"><tr><td class="empty">Open this tab to load orders.</td></tr></tbody>
    </table></div></div>
    <div class="toolbar" style="margin-top:10px"><button class="btn" id="mkMore" hidden>Show more</button><span class="stats" id="mkCount"></span></div>
    <p class="note" id="mkNote"></p>
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

  <section class="panel" id="p-delivery" hidden>
    <div class="toolbar">
      <label class="field">From <input type="date" id="repFrom"></label>
      <label class="field">To <input type="date" id="repTo"></label>
      <button class="btn primary" id="repRun">Show report</button>
      <span style="display:flex;gap:6px;flex-wrap:wrap" id="repPresets">
        <button class="btn on" data-preset="30d">Last 30 days</button>
        <button class="btn" data-preset="3m">Last 3 months</button>
        <button class="btn" data-preset="6m">Last 6 months</button>
      </span>
    </div>
    <div class="cards" id="repCards"></div>
    <div class="charts" id="repCharts"></div>
    <div class="toolbar" style="justify-content:flex-end">
      <label class="field"><input type="search" id="repSearch" placeholder="Search city" aria-label="Search city"></label>
    </div>
    <div class="sheet"><div class="scroll"><table class="t-sm">
      <thead><tr>
        <th data-sort="city">City</th><th class="num" data-sort="booked">Booked</th><th class="num" data-sort="delivered">Delivered</th>
        <th class="num" data-sort="returned">Returned</th><th class="num" data-sort="inProcess">In process</th>
        <th class="num" data-sort="deliveredAmount">Delivered amount</th><th class="num" data-sort="returnedAmount">Returned amount</th>
        <th data-sort="deliveredPctClosed" style="min-width:150px">Delivered %</th><th class="num" data-sort="deliveredAmountPct">Amount delivered %</th>
      </tr></thead>
      <tbody id="repBody"><tr><td colspan="9" class="empty">Open this tab to load the report.</td></tr></tbody>
    </table></div></div>
    <p class="note" style="margin-top:12px" id="repNote">Data comes from TCS bulk inquiry: every parcel booked in the date range with its status, city and COD value, the same source as the TCS portal dashboard. Parcels are picked by booking date. Delivered % is delivered ÷ (delivered + returned), so parcels still on the way don't count against you. Returned includes parcels on their way back. Cancelled bookings are left out. Delivered amount and Returned amount are the COD values of those parcels. Amount delivered % is delivered amount ÷ (delivered + returned amount). If TCS bulk inquiry is unavailable the page falls back to payment data, load sheets and Shopify orders.</p>
  </section>

  <section class="panel" id="p-total" hidden>
    <div class="toolbar">
      <label class="field">From <input type="date" id="totDate"></label>
      <label class="field">To <input type="date" id="totTo"></label>
      <button class="btn primary" id="totRun">Show report</button>
      <button class="btn" id="totRefresh" data-tip="Ask TCS again for every parcel instead of using the results saved in the last 15 minutes.">Refresh TCS status</button>
      <button class="btn" id="totPdf" disabled data-tip="Opens a 2-page A4 print view. Choose Save as PDF in the print window.">Download PDF</button>
      <span class="stats" id="totMeta" style="margin-left:auto"></span>
    </div>
    <div id="totBody"><p class="note">Open this tab to load yesterday's orders, or pick a From and To date.</p></div>
  </section>
</main>
<div id="tip" role="tooltip"></div>

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

/* ---------- delivery report: state and default dates (set up before the tabs run) ---------- */
let rep = { data: null, loading: false, sort: "booked", dir: -1, preset: "30d" };
const pad2 = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
function presetRange(kind) {
  const to = new Date(), from = new Date();
  if (kind === "30d") from.setDate(from.getDate() - 29); else from.setMonth(from.getMonth() - (kind === "6m" ? 6 : 3));
  return [isoLocal(from), isoLocal(to)];
}
function applyPreset(kind) {
  const [f, t] = presetRange(kind);
  $("#repFrom").value = f; $("#repTo").value = t; rep.preset = kind;
  document.querySelectorAll("[data-preset]").forEach(b => b.classList.toggle("on", b.dataset.preset === kind));
}
applyPreset("30d");
let tot = { data: null, loading: false };
let pr = { data: null, loading: false };
let ab = { data: null, loading: false };
let mk = { rows: [], at: null, loaded: false, loading: false, view: "customers", shown: 100, excluded: 0, offers: {}, today: 0, sending: false };
function ensureReport() { if (!rep.data && !rep.loading) runReport(); }

/* ---------- total delivery report (one order day, both stores + local rider) ---------- */
function yesterdayPK() { return new Date(Date.now() + 5 * 3600e3 - 86400000).toISOString().slice(0, 10); }
$("#totDate").value = yesterdayPK(); $("#totTo").value = yesterdayPK();
$("#totDate").onchange = () => { if ($("#totTo").value < $("#totDate").value) $("#totTo").value = $("#totDate").value; };
function ensureTotal() { if (!tot.data && !tot.loading) runTotal(false); }
async function runTotal(refresh) {
  if (tot.loading) return;
  const date = $("#totDate").value, to = $("#totTo").value || date; if (!date) return log("Pick an order date."); if (to < date) return log("The end date is before the start date.");
  tot.loading = true; $("#totRun").disabled = true; $("#totRefresh").disabled = true; $("#totPdf").disabled = true; log("");
  $("#totBody").innerHTML = '<p class="note">Reading orders and checking every parcel with TCS… this can take up to a minute.</p>';
  try {
    tot.data = await post({ action: "daily_report", date, to, refresh: !!refresh });
    renderTotal();
    if (tot.data.warnings.length) log(tot.data.warnings.join("  ·  "));
  } catch (e) { tot.data = null; $("#cTotal").textContent = "–"; $("#totBody").innerHTML = '<p class="note">Could not load the report: ' + esc(e.message) + "</p>"; log(e.message); }
  finally { tot.loading = false; $("#totRun").disabled = false; $("#totRefresh").disabled = false; }
}
$("#totRun").onclick = () => runTotal(false);
$("#totRefresh").onclick = () => runTotal(true);
$("#totDate").onkeydown = (e) => { if (e.key === "Enter") runTotal(false); };

function trow(label, n, sub, cls) { return "<tr" + (cls ? ' class="' + cls + '"' : "") + "><td>" + label + '</td><td class="n">' + n + '</td><td class="n sub">' + (sub == null ? "" : sub) + "</td></tr>"; }
function listRows(a) { return a.length ? "<table>" + a.map(x => "<tr><td><strong>" + esc(x.order) + '</strong><div class="sub">' + esc(x.store) + "</div></td><td>" + esc(x.detail) + '</td><td class="n">' + rs(x.amount) + "</td></tr>").join("") + "</table>" : '<p class="sub">None.</p>'; }
function totalSections(d) {
  const t = d.totals, sc = d.scenarios;
  const lists = [["Cancelled", d.lists.cancelled], ["Returned or refused", d.lists.failed], ["Still open", d.lists.open], ["Needs manual check", d.lists.manual]];
  return { t, sc, lists };
}
function renderTotal() {
  const d = tot.data; if (!d) return;
  const { t, sc, lists } = totalSections(d);
  $("#cTotal").textContent = t.ratio == null ? "–" : Math.round(t.ratio) + "%";
  $("#totPdf").disabled = false;
  $("#totMeta").textContent = "Status as of " + new Date().toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " · " + d.cache.fetched + " parcels checked with TCS, " + d.cache.reused + " reused from the last 15 minutes";
  const box = '<div class="ratiobox"><div class="big">' + pc(t.ratio) + "</div><p><strong>" + t.delivered + " of " + t.counted + " shipped orders delivered.</strong> The " + t.cancelled + " cancelled fake orders are excluded because they were never booked." + (t.unaccounted ? " The " + t.unaccounted + " orders we could not trace are not counted in this ratio; they are listed under Needs manual check." : "") + "</p></div>";
  const L0 = d.local || { total: 0, delivered: 0, failed: 0, open: 0, ratio: null };
  const localBox = '<div class="ratiobox" style="padding:10px 20px"><div class="big" style="font-size:32px">' + pc(L0.ratio) + "</div><p><strong>ISB/RWP delivery: " + L0.delivered + " of " + L0.total + " orders delivered.</strong> " + L0.failed + " returned or cancelled, " + L0.open + " still open. This is the local delivery ratio for Islamabad and Rawalpindi.</p></div>";
  const outcome = '<div class="tbox"><h3>Outcome of shipped orders</h3><table>' +
    trow("Delivered by TCS", t.deliveredTcs) + trow("Delivered by ISB/RWP delivery", t.deliveredRider) + trow("Returned, refused or cancelled", t.failed) + trow("Still open", t.open) + trow("Not accounted for (not in the ratio)", t.unaccounted) +
    trow("Shipped orders", t.shipped, d.checks[0].ok ? "adds up" : "does not add up", "sum") + "</table></div>";
  const stores = '<div class="tbox"><h3>By store</h3><table><tr><th>Store</th><th class="n">Counted</th><th class="n">Delivered</th><th class="n">Ratio</th></tr>' +
    d.stores.map(s => "<tr><td>" + esc(s.label) + (s.small ? '<div class="sub">fewer than 5 orders, ratio is not reliable</div>' : "") + '</td><td class="n">' + s.counted + '</td><td class="n">' + s.delivered + '</td><td class="n"><strong>' + pc(s.ratio) + "</strong></td></tr>").join("") + "</table></div>";
  const scen = '<div class="tbox"><h3>What the final ratio could be</h3><table>' +
    trow("Best case: every open order gets delivered", pc(sc.best.ratio), sc.best.delivered + " of " + t.counted) +
    trow("Worst case: no more deliveries", pc(sc.worst.ratio), sc.worst.delivered + " delivered, " + sc.worst.failures + " did not") +
    trow("If the " + t.cancelled + " cancelled orders were counted", pc(sc.withCancelled.ratio), t.delivered + " of " + sc.withCancelled.base) + "</table></div>";
  const split = '<div class="tbox"><h3>All orders placed</h3><table>' + trow("Cancelled or fake", d.split.cancelled) + trow("Delivered by ISB/RWP delivery (courier sheet)", d.split.rider) + trow("Booked on TCS", d.split.tcs) + trow("Not accounted for", d.split.unaccounted) +
    trow("Total orders placed", d.split.total, d.checks[1].ok ? "adds up" : "does not add up", "sum") + "</table></div>";
  const ranges = '<div class="tbox"><h3>Order numbers and booking dates</h3><table>' + d.stores.map(s => trow(esc(s.label), "#" + s.first + " to #" + s.last, s.total + " orders")).join("") +
    Object.keys(d.bookedDays).sort().map(k => trow("Booked on TCS on " + k, d.bookedDays[k])).join("") + "</table><p class=\"sub\">TCS bookings often happen 1 to 3 days after the order date.</p></div>";
  const rd = d.lists.rider || [];
  const rcount = (st) => rd.filter(x => x.status === st).length;
  const riderBox = '<div class="tbox"><h3>ISB/RWP delivery orders (' + rd.length + "): " + rcount("Delivered") + " delivered, " + rcount("Returned") + " returned, " + rcount("Still open") + " still open</h3>" +
    (rd.length ? "<table><tr><th>Order</th><th>City</th><th>Status</th><th class=\"n\">Amount</th></tr>" + rd.map(x => "<tr><td><strong>" + esc(x.order) + '</strong><div class="sub">' + esc(x.store) + "</div></td><td>" + esc(x.city || "") + "</td><td>" + x.status + '</td><td class="n">' + rs(x.amount) + "</td></tr>").join("") + "</table>" : '<p class="sub">No orders were matched to our rider for this day.</p>') + "</div>";
  const lst = '<div class="lst">' + lists.map(([n, a]) => "<details" + (a.length && n !== "Cancelled" ? " open" : "") + "><summary>" + n + " (" + a.length + ")</summary>" + listRows(a) + "</details>").join("") + "</div>";
  const foot = '<p class="note">' + esc(d.window.note) + ". ISB/RWP delivery orders are matched to the courier sheet by amount and a similar name" + (d.sheet ? " (" + d.sheet.rows + " sheet rows read just now, " + new Date(d.sheet.fetchedAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }) + ")" : "") + ". Checks: " + d.checks.map(c => (c.ok ? "✓ " : "✗ ") + esc(c.name)).join(" · ") + "</p>";
  $("#totBody").innerHTML = box + localBox + '<div class="tgrid">' + outcome + stores + scen + split + "</div>" + '<div class="tgrid">' + ranges + "</div>" + riderBox + lst + foot;
}

$("#totPdf").onclick = () => {
  const d = tot.data; if (!d) return;
  const { t, sc, lists } = totalSections(d);
  const T = (rows) => "<table>" + rows + "</table>";
  const r2 = (a, b, c) => "<tr><td>" + a + '</td><td class="n">' + b + '</td><td class="n">' + (c == null ? "" : c) + "</td></tr>";
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const fd = (x) => new Date(x + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const ord = d.dateTo && d.dateTo !== d.date ? fd(d.date) + " to " + fd(d.dateTo) : fd(d.date);
  const L = (n, a) => "<h3>" + n + " (" + a.length + ")</h3>" + (a.length ? "<table class=\"l\"><tr><th style=\"width:15%\">Order</th><th>Detail</th><th class=\"n\" style=\"width:14%\">Amount (PKR)</th></tr>" + a.map(x => "<tr><td>" + esc(x.order) + "</td><td>" + esc(x.detail) + '</td><td class="n">' + Number(x.amount).toLocaleString("en-PK") + "</td></tr>").join("") + "</table>" : "<p>None.</p>");
  const css = "@page{size:A4;margin:11mm}*{box-sizing:border-box}body{font:9.5pt/1.35 Arial,Helvetica,sans-serif;color:#111;margin:0}h1{font-size:17pt;margin:0}h2{font-size:10.5pt;margin:0 0 6px}h3{font-size:9.5pt;margin:8px 0 3px}.sub{color:#555;margin:2px 0 10px}.box{border:2px solid #2E6A4E;background:#E3EFE8;border-radius:8px;padding:10px 14px;margin-bottom:10px;display:flex;gap:16px;align-items:center}.big{font-size:32pt;font-weight:800;color:#2E6A4E}.g{display:grid;grid-template-columns:1fr 1fr;gap:10px}.c{border:1px solid #ccc;border-radius:6px;padding:7px 9px;margin-bottom:10px}table{width:100%;border-collapse:collapse}td,th{padding:3px 4px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}.n{text-align:right;white-space:nowrap}.s td{font-weight:800;border-bottom:0}table.l{font-size:8.5pt}table.l td,table.l th{padding:2px 4px}.pg{page-break-after:always}.pg:last-child{page-break-after:auto}.fn{font-size:8.5pt;color:#444;margin-top:8px}";
  const p1 = '<div class="pg"><h1>Delivery Ratio: ' + ord + " Orders</h1><div class=\"sub\">Status as of " + today + "</div>" +
    '<div class="box"><div class="big">' + pc(t.ratio) + "</div><div><strong>" + t.delivered + " of " + t.counted + " shipped orders delivered.</strong> The " + t.cancelled + " cancelled fake orders are excluded because they were never booked." + (t.unaccounted ? " The " + t.unaccounted + " orders we could not trace are not counted in this ratio; they are listed on page 2." : "") + "</div></div>" +
    '<div class="box" style="padding:6px 14px"><div class="big" style="font-size:20pt">' + pc((d.local || {}).ratio) + "</div><div><strong>ISB/RWP delivery: " + (d.local || {}).delivered + " of " + (d.local || {}).total + " orders delivered.</strong> " + (d.local || {}).failed + " returned or cancelled, " + (d.local || {}).open + " still open.</div></div>" + '<div class="g"><div class="c"><h2>Outcome of shipped orders</h2>' + T(r2("Delivered by TCS", t.deliveredTcs) + r2("Delivered by ISB/RWP delivery", t.deliveredRider) + r2("Returned, refused or cancelled", t.failed) + r2("Still open", t.open) + r2("Not accounted for (not in the ratio)", t.unaccounted) + '<tr class="s"><td>Shipped orders</td><td class="n">' + t.shipped + "</td><td></td></tr>") + "</div>" +
    '<div class="c"><h2>By store</h2>' + T("<tr><th>Store</th><th class=\"n\">Counted</th><th class=\"n\">Delivered</th><th class=\"n\">Ratio</th></tr>" + d.stores.map(s => "<tr><td>" + esc(s.label) + (s.small ? " *" : "") + '</td><td class="n">' + s.counted + '</td><td class="n">' + s.delivered + '</td><td class="n">' + pc(s.ratio) + "</td></tr>").join("")) + (d.stores.some(s => s.small) ? '<div class="fn">* fewer than 5 orders, so the ratio is not reliable.</div>' : "") + "</div></div>" +
    '<div class="g"><div class="c"><h2>What the final ratio could be</h2>' + T(r2("Best case: all open orders get delivered", pc(sc.best.ratio), sc.best.delivered + " of " + t.counted) + r2("Worst case: no more deliveries", pc(sc.worst.ratio), sc.worst.delivered + " delivered, " + sc.worst.failures + " did not") + r2("If the " + t.cancelled + " cancelled orders were counted", pc(sc.withCancelled.ratio), t.delivered + " of " + sc.withCancelled.base)) + "</div>" +
    '<div class="c"><h2>All orders placed</h2>' + T(r2("Cancelled or fake", d.split.cancelled) + r2("Delivered by ISB/RWP delivery", d.split.rider) + r2("Booked on TCS", d.split.tcs) + r2("Not accounted for", d.split.unaccounted) + '<tr class="s"><td>Total orders placed</td><td class="n">' + d.split.total + "</td><td></td></tr>") + "</div></div>" +
    '<div class="c"><h2>Order numbers and booking dates</h2>' + T(d.stores.map(s => r2(esc(s.label), "#" + s.first + " to #" + s.last, s.total + " orders")).join("") + Object.keys(d.bookedDays).sort().map(k => r2("Booked on TCS on " + k, d.bookedDays[k])).join("")) + '<div class="fn">TCS bookings often happen 1 to 3 days after the order date.</div></div></div>';
  const rd = d.lists.rider || [];
  const riderPdf = "<h3>ISB/RWP delivery orders (" + rd.length + ")</h3>" + (rd.length ? '<table class="l"><tr><th style="width:15%">Order</th><th>City</th><th>Status</th><th class="n" style="width:14%">Amount (PKR)</th></tr>' + rd.map(x => "<tr><td>" + esc(x.order) + "</td><td>" + esc(x.city || "") + "</td><td>" + x.status + '</td><td class="n">' + Number(x.amount).toLocaleString("en-PK") + "</td></tr>").join("") + "</table>" : "<p>None.</p>");
  const p2 = '<div class="pg"><h1>Order details</h1>' + riderPdf + lists.map(([n, a]) => L(n, a)).join("") +
    '<div class="fn"><strong>Sources and method.</strong> Orders come from both Shopify stores for the Pakistan time period ' + ord + " (" + esc(d.window.note) + "). Parcels booked on TCS are checked live with TCS tracking and counted by their latest status. Orders delivered locally in Rawalpindi and Islamabad (ISB/RWP delivery) are matched to the courier sheet by amount and a similar name. Cancelled and fake orders are left out of the ratio.</div></div>";
  const w = window.open("", "_blank"); if (!w) return log("Allow pop-ups to open the print view.");
  w.document.write("<!doctype html><html><head><meta charset=\"utf-8\"><title>Delivery Ratio " + esc(d.date + (d.dateTo && d.dateTo !== d.date ? " to " + d.dateTo : "")) + "</title><style>" + css + "</style></head><body>" + p1 + p2 + "</body></html>");
  w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
};

/* ---------- tabs ---------- */
function showTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
  document.querySelectorAll(".panel").forEach(p => p.hidden = p.id !== "p-" + name);
  try { history.replaceState(null, "", "#" + name); } catch (e) {}
  if (name === "delivery") ensureReport();
  if (name === "total") ensureTotal();
  if (name === "problems") ensureProblems();
  if (name === "abandoned") ensureAband();
  if (name === "marketing") ensureMarketing();
}
document.querySelectorAll(".tab").forEach(t => t.onclick = () => showTab(t.dataset.tab));
showTab(["waiting", "problems", "abandoned", "marketing", "blocked", "delivery", "total"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "waiting");

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
let storeFilter = "all";
try { storeFilter = localStorage.getItem("tcsStoreFilter") || "all"; } catch (e) {}
$("#storeFilter").value = storeFilter;
$("#storeFilter").onchange = () => {
  storeFilter = $("#storeFilter").value;
  try { localStorage.setItem("tcsStoreFilter", storeFilter); } catch (e) {}
  $("#all").checked = false; renderWaiting();
};
// Order date filter (Pakistan dates). Default: all time.
const pkDay = (iso) => new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
let dateMode = "all";
function dateRange() {
  const m = dateMode, today = pkDay(new Date().toISOString());
  if (m === "today") return [today, today];
  if (m === "7d") return [addDays(today, -6), today];
  if (m === "30d") return [addDays(today, -29), today];
  if (m === "custom") return [$("#wFrom").value || "", $("#wTo").value || ""];
  return ["", ""];
}
function visiblePending() {
  const [a, b] = dateRange();
  return state.pending.filter(o => (storeFilter === "all" || o.store === storeFilter) && (!a || (o.createdAt && pkDay(o.createdAt) >= a)) && (!b || (o.createdAt && pkDay(o.createdAt) <= b)));
}
$("#dateSeg").onclick = (e) => {
  const b = e.target.closest && e.target.closest("button[data-d]"); if (!b) return;
  dateMode = b.dataset.d;
  document.querySelectorAll("#dateSeg button").forEach(x => x.classList.toggle("on", x === b));
  $("#dateCustom").hidden = dateMode !== "custom";
  if (dateMode === "custom" && !$("#wFrom").value && !$("#wTo").value) { const t = pkDay(new Date().toISOString()); $("#wFrom").value = addDays(t, -6); $("#wTo").value = t; }
  $("#all").checked = false; renderWaiting();
};
$("#wFrom").onchange = $("#wTo").onchange = () => { $("#all").checked = false; renderWaiting(); };
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
function summaryHtml(p, readyN, cod) {
  return "<strong>" + readyN + "</strong> ready to push · " + (p.length - readyN) + " waiting on confirmation or details · " + rs(cod) + " COD" +
    (p.length !== state.pending.length ? " · showing " + p.length + " of " + state.pending.length + " orders" : "");
}
function renderWaiting() {
  setSwitch($("#auto"), state.auto); setSwitch($("#waSw"), state.waOn);
  $("#onlyConfWrap").hidden = !state.waOn;
  const p = visiblePending();
  const readyN = p.filter(ready).length;
  const cod = p.reduce((s, o) => s + (o.cod || 0), 0);
  $("#cWaiting").textContent = state.pending.length;
  $("#storeFilter").hidden = !(state.stores && state.stores.length > 1);
  $("#summary").innerHTML = summaryHtml(p, readyN, cod);
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
  }).join("") : '<tr><td colspan="7" class="empty">' + ((storeFilter !== "all" || dateMode !== "all") && state.pending.length ? "No waiting orders match this " + (storeFilter !== "all" ? "store" : "date range") + (storeFilter !== "all" && dateMode !== "all" ? " and date range" : "") + "." : "No orders waiting. New orders from your stores appear here.") + "</td></tr>";
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
  const p = visiblePending(); const readyN = p.filter(ready).length; const cod = p.reduce((s, o) => s + (o.cod || 0), 0);
  $("#summary").innerHTML = summaryHtml(p, readyN, cod);
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
$("#pushAll").onclick = () => push(visiblePending().filter(ready).map(o => o.id));

/* ---------- abandoned carts ---------- */
function ensureAband() { if (!ab.data && !ab.loading) loadAband(); }
async function loadAband() {
  if (ab.loading) return;
  const from = $("#abFrom").value, to = $("#abTo").value;
  ab.loading = true; $("#abRun").disabled = true;
  $("#abBody").innerHTML = '<tr><td colspan="5" class="empty">Loading abandoned carts…</td></tr>';
  try {
    ab.data = await post({ action: "abandoned", from, to });
    if (!from) $("#abFrom").value = ab.data.from; if (!to) $("#abTo").value = ab.data.to;
    if (ab.data.warnings.length) log(ab.data.warnings.join("  ·  "));
    renderAband(); loadAbStats(from, to);
  } catch (e) { ab.data = null; $("#abBody").innerHTML = '<tr><td colspan="5" class="empty">Couldn\'t load abandoned carts: ' + esc(e.message) + "</td></tr>"; }
  finally { ab.loading = false; $("#abRun").disabled = false; }
}
function renderAband() {
  if (!ab.data) return;
  const all = ab.data.rows, open = all.filter(r => !r.handled);
  $("#cAband").textContent = open.length;
  const list = $("#abHidden").checked ? all : open;
  $("#abMeta").textContent = open.length + " to follow up · " + (all.length - open.length) + " handled";
  $("#abBody").innerHTML = list.length ? list.map(r =>
    "<tr><td><strong>" + esc(r.name) + "</strong>" + storeBadge(r) + '<div class="sub">' + esc(r.city) + "</div></td>" +
    "<td>" + (r.phone ? '<a href="tel:' + esc(r.phone) + '">' + esc(r.phone) + "</a>" + (r.wa ? ' · <a href="https://wa.me/92' + esc(r.wa.slice(1)) + '" target="_blank" rel="noopener">WhatsApp</a>' : "") : "") + (r.email ? '<div class="sub"><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + "</a></div>" : "") + "</td>" +
    "<td>" + esc(r.items || "No items") + '<div class="sub">Rs ' + esc(r.amount) + (r.url ? ' · <a href="' + esc(r.url) + '" target="_blank" rel="noopener">Checkout link</a>' : "") + "</div></td>" +
    "<td>" + when(r.createdAt) + "</td>" +
    "<td>" + (r.offered ? '<span class="chip wait" data-tip="10% offer sent on WhatsApp">Offer sent</span> ' : (r.wa && !r.handled ? '<button class="btn" data-aboffer="' + esc(r.id) + '">Send 10% offer</button> ' : "")) + (r.handled ? '<span class="chip ok">Handled</span>' : '<button class="btn" data-abdone="' + esc(r.id) + '">Mark done</button>') + "</td></tr>").join("")
    : '<tr><td colspan="5" class="empty">No abandoned carts with contact details in this range.</td></tr>';
  document.querySelectorAll("[data-aboffer]").forEach(b => b.onclick = async () => {
    if (!confirm("Send this customer a WhatsApp message with a one-time 10% discount link?")) return;
    b.disabled = true;
    try { await post({ action: "abandoned_offer", id: b.dataset.aboffer }); const r = ab.data.rows.find(x => x.id === b.dataset.aboffer); if (r) { r.offered = new Date().toISOString(); r.handled = true; } log("Offer sent and marked done."); renderAband(); }
    catch (e) { b.disabled = false; log("Couldn't send the offer: " + e.message); }
  });
  document.querySelectorAll("[data-abdone]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await post({ action: "abandoned_handled", id: b.dataset.abdone }); const r = ab.data.rows.find(x => x.id === b.dataset.abdone); if (r) r.handled = true; renderAband(); }
    catch (e) { b.disabled = false; log("Couldn't mark done: " + e.message); }
  });
}
async function loadAbStats(from, to) {
  $("#abStats").innerHTML = '<p class="note">Checking how many offers worked…</p>';
  try {
    const d = await post({ action: "abandoned_stats", from: from || ab.data.from, to: to || ab.data.to });
    const rows = d.orders.map(o => "<tr><td><strong>" + esc(o.name) + "</strong><div class=\"sub\">" + esc(o.store) + "</div></td><td>" + esc(o.customer) + "</td><td>" + when(o.at) + '</td><td class="n">' + rs(o.amount) + '</td><td class="n">' + rs(o.discount) + "</td></tr>").join("");
    $("#abStats").innerHTML = '<div class="tbox"><h3>How the 10% offers worked (' + esc(d.from) + " to " + esc(d.to) + ")</h3>" +
      '<table><tr><td>Offers sent</td><td class="n">' + d.sent + "</td></tr><tr><td>Carts recovered (ordered with their code)</td><td class=\"n\"><strong>" + d.recovered + "</strong>" + (d.rate == null ? "" : " (" + d.rate + "%)") + "</td></tr><tr><td>Sales recovered</td><td class=\"n\"><strong>" + rs(d.revenue) + "</strong></td></tr><tr><td>Discount given</td><td class=\"n\">" + rs(d.discount) + "</td></tr></table>" +
      (d.sent ? '<p class="sub">Counts offers sent in this date range. Cancelled orders are not counted. An offer only counts when the customer orders with the code we sent.</p>' : '<p class="sub">No offers sent in this date range yet.</p>') +
      (rows ? '<table style="margin-top:8px"><tr><th>Order</th><th>Customer</th><th>Placed</th><th class="n">Total</th><th class="n">Discount</th></tr>' + rows + "</table>" : "") + "</div>";
  } catch (e) { $("#abStats").innerHTML = '<p class="note">Couldn\'t load offer results: ' + esc(e.message) + "</p>"; }
}
{ const t = new Date(Date.now() + 5 * 3600e3); $("#abTo").value = t.toISOString().slice(0, 10); $("#abFrom").value = new Date(t - 6 * 86400000).toISOString().slice(0, 10); }
$("#abRun").onclick = loadAband;
$("#abAll").onclick = async () => {
  if (!ab.data) return log("Press Show first.");
  const todo = ab.data.rows.filter(r => r.wa && !r.offered && !r.handled);
  if (!todo.length) return log("Nobody left to message: every cart with a mobile number has been messaged or marked done.");
  if (!confirm("Send the WhatsApp 10% offer to " + todo.length + " customer" + (todo.length === 1 ? "" : "s") + "? Each one gets their own one-time code and is marked done after the message is sent.")) return;
  $("#abAll").disabled = true; let ok = 0, fail = 0, streak = 0;
  for (const r of todo) {
    log("Sending offers… " + (ok + fail) + " of " + todo.length);
    try { await post({ action: "abandoned_offer", id: r.id }); r.offered = new Date().toISOString(); r.handled = true; ok++; streak = 0; }
    catch (e) { fail++; streak++; log("Couldn't send to " + r.name + ": " + e.message); if (streak >= 3) { log("Stopped after 3 failures in a row. " + ok + " sent."); break; } }
  }
  $("#abAll").disabled = false; renderAband();
  log(ok + " offer" + (ok === 1 ? "" : "s") + " sent and marked done" + (fail ? ", " + fail + " failed (still in the list)" : "") + ".");
};
$("#abTest").onclick = async () => {
  const row = ab.data && ab.data.rows.find(r => !r.handled && !r.offered && r.wa) || ab.data && ab.data.rows.find(r => r.wa);
  if (!row) return log("There is no cart with a phone number to use for the test.");
  const to = prompt("Your own WhatsApp number (03XX XXXXXXX). The test message uses the cart of " + row.name + " but is sent only to you:"); if (!to) return;
  try { const r = await post({ action: "abandoned_offer", id: row.id, testTo: to }); log("Test sent to " + r.to + ". Link: " + r.link); }
  catch (e) { log("Couldn't send the test: " + e.message); }
};
$("#abHidden").onchange = renderAband;

/* ---------- marketing workflow: all orders, grouped into customers ---------- */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function idb(mode, fn) {
  return new Promise((resolve) => {
    try {
      const q = indexedDB.open("tcs-marketing", 1);
      q.onupgradeneeded = () => q.result.createObjectStore("kv");
      q.onerror = () => resolve(null);
      q.onsuccess = () => {
        try { const t = q.result.transaction("kv", mode), r = fn(t.objectStore("kv")); t.oncomplete = () => resolve(r && r.result !== undefined ? r.result : null); t.onerror = () => resolve(null); } catch (e) { resolve(null); }
      };
    } catch (e) { resolve(null); }
  });
}
function idbGet() { return idb("readonly", s => s.get("data")); }
function idbPut(v) { return idb("readwrite", s => s.put(v, "data")); }

async function ensureMarketing() {
  if (mk.loaded || mk.loading) return;
  mk.loaded = true;
  const d = await idbGet();
  loadMkOffers();
  if (d && d.rows && d.rows.length) { mk.rows = d.rows; mk.at = d.at; mk.excluded = d.excluded || 0; mkReady(); }
  else { $("#mkBody").innerHTML = '<tr><td class="empty">No orders loaded yet. Press "Refresh orders from Shopify" to load them (takes a few minutes the first time).</td></tr>'; $("#mkMeta").textContent = ""; }
}
function mkMsg(m) { $("#mkMeta").textContent = m; }
async function mkStream(key, onCount) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mk_data", store: key }) });
  if (!r.ok) { let m = "HTTP " + r.status; try { m = (await r.json()).error || m; } catch (e) {} throw new Error(m); }
  const reader = r.body.getReader(), dec = new TextDecoder(), out = []; let buf = "";
  for (;;) {
    const x = await reader.read(); if (x.done) break;
    buf += dec.decode(x.value, { stream: true });
    let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line) out.push(JSON.parse(line)); }
    onCount(out.length);
  }
  if (buf.trim()) out.push(JSON.parse(buf));
  return out;
}
async function mkRefresh() {
  if (mk.loading) return; mk.loading = true; $("#mkRefresh").disabled = true; log("");
  try {
    mkMsg("Asking Shopify to export all orders…");
    const st = await post({ action: "mk_start", days: Number($("#mkDays").value) || 0 }), ids = {};
    st.stores.forEach(s => { if (s.error) throw new Error(s.label + ": " + s.error); ids[s.key] = s.id; });
    const t0 = Date.now();
    for (;;) {
      await sleep(4000);
      const d = await post({ action: "mk_status" });
      const bad = d.stores.find(s => ["FAILED", "CANCELED", "EXPIRED"].includes(s.status) && s.id === ids[s.key]);
      if (bad) throw new Error(bad.label + ": Shopify's export " + bad.status.toLowerCase() + (bad.error ? " (" + bad.error + ")" : ""));
      d.stores.forEach(s => { if (s.id && s.id !== ids[s.key] && s.status !== "COMPLETED") ids[s.key] = s.id; });
      mkMsg("Shopify is preparing the export: " + d.stores.map(s => s.label + " " + (s.status === "COMPLETED" ? "ready" : s.count.toLocaleString("en-PK") + " records")).join(" · ") + " (" + Math.round((Date.now() - t0) / 1000) + "s)");
      if (d.stores.every(s => s.id === ids[s.key] && s.status === "COMPLETED")) break;
      if (Date.now() - t0 > 25 * 60e3) throw new Error("Shopify is taking too long. Try again in a few minutes.");
    }
    let all = [];
    for (const s of st.stores) {
      const base = all.length;
      const rows = await mkStream(s.key, n => mkMsg("Downloading " + s.label + ": " + (base + n).toLocaleString("en-PK") + " orders…"));
      all = all.concat(rows);
    }
    mk.excluded = all.filter(o => o.x).length;
    mk.rows = all.filter(o => !o.x); mk.at = new Date().toISOString();
    await idbPut({ rows: mk.rows, at: mk.at, excluded: mk.excluded });
    mkReady();
  } catch (e) { log("Couldn't load orders: " + e.message); mkMsg(mk.rows.length ? "Showing the earlier saved copy." : ""); }
  finally { mk.loading = false; $("#mkRefresh").disabled = false; }
}
function mkReady() {
  const oldest = mk.rows.reduce((m, o) => (o.d < m ? o.d : m), "9999");
  $("#mkMeta").textContent = mk.rows.length.toLocaleString("en-PK") + " orders · oldest " + (mk.rows.length ? pkDay(oldest) : "–") + " · loaded " + when(mk.at);
  $("#mkCsv").disabled = false;
  mkRender();
}

function mkPeriodRange() {
  const p = $("#mkPeriod").value, t = pkDay(new Date().toISOString());
  if (p === "all") return [null, null];
  if (p === "today") return [t, t];
  if (p === "7d") return [addDays(t, -6), t];
  if (p === "30d") return [addDays(t, -29), t];
  if (p === "90d") return [addDays(t, -89), t];
  if (p === "week") { const dow = (new Date(t + "T00:00:00Z").getUTCDay() + 6) % 7; return [addDays(t, -dow), t]; }
  if (p === "month") return [t.slice(0, 8) + "01", t];
  if (p === "lastmonth") { const first = t.slice(0, 8) + "01", prev = addDays(first, -1); return [prev.slice(0, 8) + "01", prev]; }
  return [$("#mkFrom").value || null, $("#mkTo").value || null];
}
function mkSortOptions() {
  const o = mk.view === "customers"
    ? [["spend", "Highest total spent"], ["orders", "Most orders"], ["avg", "Highest average order"], ["recent", "Newest order"], ["oldest", "Oldest order"], ["name", "Name A–Z"]]
    : [["recent", "Newest first"], ["oldest", "Oldest first"], ["amount", "Highest amount"], ["name", "Name A–Z"]];
  const cur = $("#mkSort").value;
  $("#mkSort").innerHTML = o.map(x => '<option value="' + x[0] + '">' + x[1] + "</option>").join("");
  if (o.some(x => x[0] === cur)) $("#mkSort").value = cur; else $("#mkSort").value = mk.view === "customers" ? "spend" : "recent";
}
function mkCompute() {
  const [a, b] = mkPeriodRange(), store = $("#mkStore").value, q = $("#mkSearch").value.trim().toLowerCase();
  const orders = mk.rows.filter(o => (store === "all" || o.s === store) && (!a || pkDay(o.d) >= a) && (!b || pkDay(o.d) <= b));
  // customers: same phone number = same person, across both stores
  const map = new Map();
  for (const o of orders) {
    const key = /^03\d{9}$/.test(o.p) ? o.p : "o" + o.s + o.n;
    let c = map.get(key);
    if (!c) { c = { key, store: o.s, name: o.c, phone: /^03\d{9}$/.test(o.p) ? o.p : (o.p || ""), city: o.y, orders: 0, spent: 0, last: o.d, first: o.d, products: [], stores: {} }; map.set(key, c); }
    c.orders++; c.spent += o.a; c.stores[o.s] = 1;
    if (o.d > c.last) { c.last = o.d; c.store = o.s; if (o.c) c.name = o.c; if (o.y) c.city = o.y; }
    if (o.d < c.first) c.first = o.d;
    if (o.i && c.products.length < 3 && c.products.indexOf(o.i) < 0) c.products.push(o.i);
  }
  const all = [...map.values()];
  const counts = { all: all.length, 1: 0, 2: 0, 3: 0 };
  all.forEach(c => { counts[c.orders >= 3 ? 3 : c.orders]++; });
  const g = $("#mkGroup").value;
  const okC = c => (g === "all" || (g === "3" ? c.orders >= 3 : c.orders === Number(g)));
  const hit = (txt) => !q || txt.toLowerCase().indexOf(q) >= 0;
  return { orders, all, counts, g, okC, hit, revenue: orders.reduce((s, o) => s + o.a, 0) };
}
var mkView = [];
function mkRender() {
  if (!mk.rows.length) return;
  mkSortOptions();
  const c = mkCompute(), sort = $("#mkSort").value, lim = Number($("#mkLimit").value);
  if (mk.view === "customers") {
    const of = $("#mkOffer").value;
    let list = c.all.filter(x => c.okC(x) && c.hit(x.name + " " + x.phone) && (of === "all" || (of === "sent") === !!mk.offers[x.phone]));
    const by = { spend: (x, y) => y.spent - x.spent, orders: (x, y) => y.orders - x.orders || y.spent - x.spent, avg: (x, y) => y.spent / y.orders - x.spent / x.orders, recent: (x, y) => (y.last > x.last ? 1 : -1), oldest: (x, y) => (x.last > y.last ? 1 : -1), name: (x, y) => String(x.name).localeCompare(String(y.name)) };
    list.sort(by[sort] || by.spend);
    if (lim) list = list.slice(0, lim);
    mkView = list;
    $("#mkHead").innerHTML = "<tr><th>#</th><th>Customer</th><th>Phone</th><th class=\"n\">Orders</th><th class=\"n\">Total spent</th><th class=\"n\">Average</th><th>Last order</th><th>Products bought</th><th>Offer</th></tr>";
    $("#mkBody").innerHTML = list.length ? list.slice(0, mk.shown).map((x, i) =>
      "<tr><td>" + (i + 1) + "</td><td><strong>" + esc(x.name || "–") + '</strong><div class="sub">' + esc(x.city) + (x.stores.house && x.stores.herbs ? " · both stores" : x.stores.herbs ? " · Herbs" : "") + "</div></td><td>" + esc(x.phone || "–") + '</td><td class="n"><strong>' + x.orders + '</strong></td><td class="n">' + rs(x.spent) + '</td><td class="n">' + rs(Math.round(x.spent / x.orders)) + "</td><td>" + esc(pkDay(x.last)) + "</td><td>" + esc(x.products.join(" · ")) + "</td><td>" + (mk.offers[x.phone] ? '<span class="chip ok" data-tip="Code ' + esc(mk.offers[x.phone][0]) + '">Sent ' + esc(pkDay(mk.offers[x.phone][1])) + "</span>" : "–") + "</td></tr>").join("")
      : '<tr><td colspan="9" class="empty">No customers match.</td></tr>';
  } else {
    const ok = new Set(c.all.filter(c.okC).map(x => x.key));
    let list = c.orders.filter(o => { const key = /^03\d{9}$/.test(o.p) ? o.p : "o" + o.s + o.n; return (c.g === "all" || ok.has(key)) && c.hit(o.c + " " + o.p + " " + o.n); });
    const by = { recent: (x, y) => (y.d > x.d ? 1 : -1), oldest: (x, y) => (x.d > y.d ? 1 : -1), amount: (x, y) => y.a - x.a, name: (x, y) => String(x.c).localeCompare(String(y.c)) };
    list.sort(by[sort] || by.recent);
    if (lim) list = list.slice(0, lim);
    mkView = list;
    $("#mkHead").innerHTML = "<tr><th>Order</th><th>Customer</th><th>Phone</th><th>Product bought</th><th class=\"n\">Amount</th><th>Date</th></tr>";
    $("#mkBody").innerHTML = list.length ? list.slice(0, mk.shown).map(o =>
      "<tr><td><strong>" + esc(o.n) + '</strong><div class="sub">' + (o.s === "herbs" ? "Chitral Herbs" : "Chitral House") + "</div></td><td>" + esc(o.c || "–") + '<div class="sub">' + esc(o.y) + "</div></td><td>" + esc(o.p || "–") + "</td><td>" + esc(o.i) + '</td><td class="n">' + rs(o.a) + "</td><td>" + when(o.d) + "</td></tr>").join("")
      : '<tr><td colspan="6" class="empty">No orders match.</td></tr>';
  }
  $("#mkMore").hidden = mkView.length <= mk.shown;
  $("#mkCount").textContent = "Showing " + Math.min(mk.shown, mkView.length).toLocaleString("en-PK") + " of " + mkView.length.toLocaleString("en-PK") + (mk.view === "customers" ? " customers" : " orders");
  $("#cMk").textContent = c.all.length.toLocaleString("en-PK");
  const card = (v, label, sub, grp) => '<' + (grp ? 'button type="button" class="mkcard click' + (c.g === grp ? " on" : "") + '" data-g="' + grp + '"' : 'div class="mkcard"') + '><div class="v">' + v + '</div><div class="s">' + label + (sub ? " · " + sub : "") + "</div></" + (grp ? "button" : "div") + ">";
  const pct = (n) => (c.all.length ? Math.round(100 * n / c.all.length) + "%" : "–");
  $("#mkCards").innerHTML = card(c.all.length.toLocaleString("en-PK"), "Customers", "", "all") + card(c.orders.length.toLocaleString("en-PK"), "Orders", "") + card(rs(c.revenue), "Sales", "") +
    card(c.counts[1].toLocaleString("en-PK"), "Single order", pct(c.counts[1]), "1") + card(c.counts[2].toLocaleString("en-PK"), "Double order", pct(c.counts[2]), "2") + card(c.counts[3].toLocaleString("en-PK"), "3 or more", pct(c.counts[3]), "3");
  document.querySelectorAll("#mkCards [data-g]").forEach(b => b.onclick = () => { $("#mkGroup").value = b.dataset.g; mk.shown = 100; mkRender(); });
  $("#mkNote").textContent = (mk.excluded ? mk.excluded.toLocaleString("en-PK") + " cancelled, voided, refunded or fake orders are left out. " : "") + "Customers are matched by phone number across both stores. Returned parcels are not excluded yet, because Shopify does not record TCS returns.";
}

async function loadMkOffers() {
  try { const d = await post({ action: "mk_offers" }); mk.offers = d.sent || {}; mk.today = d.today || 0; $("#mkOfferMeta").textContent = d.total.toLocaleString("en-PK") + " offers sent so far · " + d.today.toLocaleString("en-PK") + " today"; if (mk.rows.length) mkRender(); }
  catch (e) { $("#mkOfferMeta").textContent = "Couldn't load the sent-offers list: " + e.message; }
}
async function mkSendOffers() {
  if (mk.sending) { mk.stop = true; return log("Stopping after the current batch…"); }
  if (mk.view !== "customers") return log("Switch to the Customers view to send offers.");
  const cap = Number($("#mkCap").value) || 1500, days = Number($("#mkDays2").value) || 14;
  const todo = mkView.filter(x => /^03\d{9}$/.test(x.phone) && !mk.offers[x.phone]);
  const room = Math.max(0, cap - mk.today), n = Math.min(todo.length, room);
  if (!todo.length) return log("Nobody to message: every customer shown has already been sent an offer, or has no valid mobile number.");
  if (!n) return log("The daily limit of " + cap + " is already used up today.");
  if (!confirm("Send a unique one-time 10% code on WhatsApp to " + n.toLocaleString("en-PK") + " customer" + (n === 1 ? "" : "s") + (todo.length > n ? " (the daily limit allows " + n + " of the " + todo.length + " shown)" : "") + "?\n\nEstimated message cost: about Rs " + Math.round(n * 13.5).toLocaleString("en-PK") + ". Each code is valid for " + days + " days and works once.")) return;
  mk.sending = true; mk.stop = false; $("#mkSend").textContent = "Stop sending";
  let ok = 0, fail = 0, skip = 0;
  const list = todo.slice(0, n);
  try {
    for (let i = 0; i < list.length && !mk.stop; i += 15) {
      const batch = list.slice(i, i + 15).map(x => ({ phone: x.phone, name: x.name, store: x.store }));
      log("Sending offers… " + (ok + fail + skip) + " of " + list.length);
      const d = await post({ action: "mk_send", items: batch, days, cap });
      d.results.forEach(r => { if (r.ok) ok++; else if (r.skipped) skip++; else { fail++; if (fail <= 3) log("Couldn't send to " + r.phone + ": " + r.error); } });
      await loadMkOffers();
      if (fail >= 10 && ok === 0) { log("Stopped: the first sends all failed. Check that the ch_reorder_offer template is approved."); break; }
    }
  } catch (e) { log("Stopped: " + e.message); }
  mk.sending = false; $("#mkSend").textContent = "Send 10% offer to shown customers";
  log(ok + " offer" + (ok === 1 ? "" : "s") + " sent" + (skip ? ", " + skip + " skipped" : "") + (fail ? ", " + fail + " failed" : "") + ".");
}
$("#mkSend").onclick = mkSendOffers;
$("#mkOffer").onchange = () => { mk.shown = 100; mkRender(); };
$("#mkTest").onclick = async () => {
  const x = mkView[0]; if (!x || mk.view !== "customers") return log("Switch to the Customers view first.");
  const to = prompt("Your own WhatsApp number (03XX XXXXXXX). The test uses the name " + x.name + " but is sent only to you:"); if (!to) return;
  try { const d = await post({ action: "mk_send", items: [{ phone: x.phone, name: x.name, store: x.store }], days: Number($("#mkDays2").value) || 14, testTo: to }); const r = d.results[0]; log(r.ok ? "Test sent. Link: " + r.link : "Couldn't send the test: " + (r.error || r.skipped)); }
  catch (e) { log("Couldn't send the test: " + e.message); }
};
$("#mkResBtn").onclick = async () => {
  $("#mkResults").innerHTML = '<p class="note">Checking which codes were used…</p>';
  try {
    const d = await post({ action: "mk_results" });
    const rows = d.orders.map(o => "<tr><td><strong>" + esc(o.name) + '</strong><div class="sub">' + esc(o.store) + "</div></td><td>" + esc(o.customer) + "</td><td>" + when(o.at) + '</td><td class="n">' + rs(o.amount) + '</td><td class="n">' + rs(o.discount) + "</td></tr>").join("");
    $("#mkResults").innerHTML = '<div class="tbox"><h3>How the 10% offers worked</h3><table><tr><td>Offers sent</td><td class="n">' + d.sent + '</td></tr><tr><td>Codes used on an order</td><td class="n"><strong>' + d.used + "</strong>" + (d.sent ? " (" + (100 * d.used / d.sent).toFixed(1) + "%)" : "") + '</td></tr><tr><td>Sales from these orders</td><td class="n"><strong>' + rs(d.revenue) + '</strong></td></tr><tr><td>Discount given</td><td class="n">' + rs(d.discount) + "</td></tr></table>" +
      (rows ? '<table style="margin-top:8px"><tr><th>Order</th><th>Customer</th><th>Placed</th><th class="n">Total</th><th class="n">Discount</th></tr>' + rows + "</table>" : "") + "</div>";
  } catch (e) { $("#mkResults").innerHTML = '<p class="note">Couldn\'t load results: ' + esc(e.message) + "</p>"; }
};
function mkCsv() {
  const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const head = mk.view === "customers" ? ["Customer", "Phone", "City", "Orders", "Total spent", "Average order", "First order", "Last order", "Products", "Offer sent"] : ["Order", "Store", "Customer", "Phone", "City", "Product", "Amount", "Date"];
  const rows = mkView.map(x => mk.view === "customers" ? [x.name, x.phone, x.city, x.orders, x.spent, Math.round(x.spent / x.orders), pkDay(x.first), pkDay(x.last), x.products.join(" · "), mk.offers[x.phone] ? pkDay(mk.offers[x.phone][1]) : ""] : [x.n, x.s === "herbs" ? "Chitral Herbs" : "Chitral House", x.c, x.p, x.y, x.i, x.a, pkDay(x.d)]);
  const blob = new Blob(["﻿" + [head].concat(rows).map(r => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "marketing-" + mk.view + "-" + pkDay(new Date().toISOString()) + ".csv"; document.body.appendChild(a); a.click(); a.remove();
}
document.querySelectorAll("#mkView button").forEach(b => b.onclick = () => { mk.view = b.dataset.v; mk.shown = 100; document.querySelectorAll("#mkView button").forEach(x => x.classList.toggle("on", x === b)); $("#mkSort").value = ""; mkRender(); });
["#mkPeriod", "#mkGroup", "#mkSort", "#mkLimit", "#mkStore", "#mkFrom", "#mkTo"].forEach(id => { $(id).onchange = () => { if (id === "#mkPeriod") $("#mkCustom").hidden = $("#mkPeriod").value !== "custom"; mk.shown = 100; mkRender(); }; });
$("#mkSearch").oninput = () => { mk.shown = 100; mkRender(); };
$("#mkMore").onclick = () => { mk.shown += 200; mkRender(); };
$("#mkRefresh").onclick = mkRefresh;
$("#mkCsv").onclick = mkCsv;

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

/* ---------- delivery problems: every in-process parcel ---------- */
function ensureProblems() { if (!pr.data && !pr.loading) loadProblems(false); }
async function loadProblems(refresh) {
  if (pr.loading) return;
  pr.loading = true; $("#prRefresh").disabled = true;
  $("#problems").innerHTML = '<tr><td colspan="7" class="empty">Checking every in-process parcel with TCS… this can take up to a minute.</td></tr>';
  try {
    pr.data = await post({ action: "in_process", refresh: !!refresh });
    const sel = $("#prStatus"), keep = sel.value, counts = {};
    pr.data.rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    sel.innerHTML = '<option value="">All statuses (' + pr.data.rows.length + ")</option>" + Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map(k => '<option value="' + esc(k) + '">' + esc(k) + " (" + counts[k] + ")</option>").join("");
    sel.value = counts[keep] ? keep : "";
    $("#cProblems").textContent = pr.data.rows.length;
    document.querySelector('.tab[data-tab="problems"]').classList.toggle("alert", pr.data.rows.some(r => r.issue && !r.handled));
    $("#prMeta").textContent = pr.data.checked + " parcels checked with TCS, " + pr.data.reused + " reused from the last 15 minutes";
    if (pr.data.warnings.length) log(pr.data.warnings.join("  ·  "));
    renderProblems();
  } catch (e) { pr.data = null; $("#problems").innerHTML = '<tr><td colspan="7" class="empty">Couldn\'t load delivery problems: ' + esc(e.message) + "</td></tr>"; }
  finally { pr.loading = false; $("#prRefresh").disabled = false; }
}
function renderProblems() {
  if (!pr.data) return;
  const st = $("#prStatus").value, day = $("#prDate").value;
  const list = pr.data.rows.filter(r => (!st || r.status === st) && (!day || pkDay(r.createdAt) === day));
  const reply = (p) => p.reply === "retry" ? '<span class="chip ok">Wants delivery again</span>'
    : p.reply === "cancel" ? '<span class="chip bad">Wants to cancel</span>'
    : p.reply === "asked" ? '<span class="chip wait">Asked, no reply</span>' : '<span class="sub">Not messaged</span>';
  $("#problems").innerHTML = list.length ? list.map(p =>
    '<tr><td><span class="order">' + esc(p.name) + "</span>" + storeBadge(p) + '<div class="sub">' + esc(pkDay(p.createdAt)) + " · " + esc(p.city) + " · Rs " + esc(p.cod) + "</div></td>" +
    "<td>" + esc(p.customer) + '<div class="sub"><a href="tel:' + esc(p.phone) + '">' + esc(p.phone) + "</a></div></td>" +
    '<td><a href="https://www.tcsexpress.com/track/' + esc(p.cn) + '" target="_blank" rel="noopener">' + esc(p.cn) + "</a></td>" +
    '<td><span class="chip ' + (p.issue ? "bad" : "wait") + '">' + esc(p.status) + "</span></td>" +
    "<td>" + esc(p.latest) + '<div class="sub">' + esc(p.when) + (p.booked ? " · booked " + esc(p.booked) : "") + "</div>" + (p.events || []).map(e => '<div class="sub">' + esc(e) + "</div>").join("") + "</td>" +
    "<td>" + reply(p) + "</td>" +
    "<td>" + (p.handled ? '<span class="chip ok">Handled</span>' : '<button class="btn" data-handled="' + esc(p.id) + '">Mark done</button>') + "</td></tr>").join("")
    : '<tr><td colspan="7" class="empty">No in-process parcels match.</td></tr>';
  document.querySelectorAll("[data-handled]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await post({ action: "problem_handled", id: b.dataset.handled }); const r = pr.data.rows.find(x => x.id === b.dataset.handled); if (r) r.handled = true; renderProblems(); }
    catch (e) { b.disabled = false; log("Couldn't mark done: " + e.message); }
  });
}
$("#prStatus").onchange = renderProblems;
$("#prDate").onchange = () => { $("#prAll").classList.toggle("on", !$("#prDate").value); renderProblems(); };
$("#prAll").onclick = () => { $("#prDate").value = ""; $("#prAll").classList.add("on"); renderProblems(); };
$("#prRefresh").onclick = () => loadProblems(true);


/* ---------- delivery report ---------- */
const pc = (v) => v == null ? "–" : v + "%";
async function runReport() {
  if (rep.loading) return;
  const from = $("#repFrom").value, to = $("#repTo").value;
  if (!from || !to) return log("Pick both dates.");
  if (from > to) return log("The From date is after the To date.");
  rep.loading = true; $("#repRun").disabled = true; log("");
  $("#repCards").innerHTML = ""; $("#repCharts").innerHTML = "";
  $("#repBody").innerHTML = '<tr><td colspan="9" class="empty">Pulling parcels from TCS… this can take up to a minute for longer ranges.</td></tr>';
  try {
    rep.data = await post({ action: "delivery_report", from, to });
    renderReport();
    if (rep.data.partial) log("Some of the range couldn't be loaded from TCS, so these numbers are incomplete: " + rep.data.warnings.join("  ·  "));
  } catch (e) {
    rep.data = null;
    $("#cDelivery").textContent = "–"; $("#repCharts").innerHTML = "";
    $("#repBody").innerHTML = '<tr><td colspan="9" class="empty">Couldn\'t load the report: ' + esc(e.message) + "</td></tr>";
  } finally { rep.loading = false; $("#repRun").disabled = false; }
}
function statusLine(map) {
  const e = Object.entries(map || {}).sort((a, b) => b[1] - a[1]);
  return e.map(([k, v]) => v + " " + k.toLowerCase()).join(" · ");
}
function renderReport() {
  const d = rep.data; if (!d) return;
  const t = d.totals;
  $("#cDelivery").textContent = t.deliveredPctClosed == null ? "–" : Math.round(t.deliveredPctClosed) + "%";
  const card = (cls, k, v, sub) => '<div class="card ' + cls + '"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + sub + "</div></div>";
  $("#repCards").innerHTML =
    card("main", "Delivered %", pc(t.deliveredPctClosed), "of " + t.closed + " finished parcels") +
    card("", "Delivered", t.delivered, pc(t.deliveredPctBooked) + " of all booked") +
    card("ret", "Returned", t.returned, pc(t.returnedPctClosed) + " of finished parcels") +
    card("", "In process", t.inProcess, esc(statusLine(d.inProcessStatus)) || "Nothing on the way") +
    card("ret", "Undelivered", t.undelivered || 0, "failed attempt or address / phone problem (part of in process)") +
    card("main", "Delivered amount", rs(t.deliveredAmount), pc(t.deliveredAmountPct) + " of delivered + returned amount" + (t.deliveredNoAmount ? " · " + t.deliveredNoAmount + " delivered parcels have no amount yet, not counted" : "")) +
    card("ret", "Returned amount", rs(t.returnedAmount), "real order value of " + (t.returned - (t.returnedNoAmount || 0)) + " returned parcels" + (t.returnedNoAmount ? " · " + t.returnedNoAmount + " with no amount found, not counted" : "")) +
    card("", "Booked", t.booked, "<strong>" + rs(t.bookedAmount) + "</strong> booked amount · " + esc(d.range.from) + " to " + esc(d.range.to) + (t.cancelled ? " · " + t.cancelled + " cancelled left out" : "") + (t.notPicked ? " · " + t.notPicked + " booked but not picked up yet, left out" : "") + (d.supplemented ? " · " + d.supplemented + " still on the way added from tracking" : ""));
  renderCharts();
  renderCities();
}

/* ---------- charts (plain SVG/CSS, no libraries) ---------- */
const MIN_FINISHED = 8; // a city needs this many delivered + returned parcels to be ranked best/lowest
const CIRC = 2 * Math.PI * 52;
function donutChart(t) {
  const parts = [["Delivered", t.delivered, "var(--pine)"], ["Returned", t.returned, "var(--rust)"], ["In process", t.inProcess, "var(--house)"]];
  const tot = parts.reduce((x, p) => x + p[1], 0);
  if (!tot) return "";
  let off = 0;
  const arcs = parts.filter(p => p[1]).map(p => {
    const len = CIRC * p[1] / tot, draw = Math.max(0.5, len - (parts.filter(q => q[1]).length > 1 ? 2.5 : 0));
    const el = '<circle cx="70" cy="70" r="52" fill="none" stroke="' + p[2] + '" stroke-width="18" stroke-dasharray="' + draw.toFixed(2) + " " + (CIRC - draw).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 70 70)" data-tip="' + esc(p[0] + ": " + p[1].toLocaleString("en-PK") + " parcels (" + (100 * p[1] / tot).toFixed(1) + "% of " + tot.toLocaleString("en-PK") + ")") + '"></circle>';
    off += len; return el;
  }).join("");
  const legend = parts.map(p => '<div data-tip="' + esc(p[0] + ": " + p[1].toLocaleString("en-PK") + " parcels (" + (100 * p[1] / tot).toFixed(1) + "%)") + '"><i style="background:' + p[2] + '"></i>' + p[0] + "<b>" + p[1].toLocaleString("en-PK") + '</b><span class="sub">' + (100 * p[1] / tot).toFixed(1) + "%</span></div>").join("");
  return '<div class="chart"><h3>Parcel status</h3><p class="cap">Share of all ' + tot.toLocaleString("en-PK") + " parcels booked in this range</p>" +
    '<div class="donutwrap"><svg width="150" height="150" viewBox="0 0 140 140" role="img" aria-label="Delivered, returned and in process share">' +
    '<circle cx="70" cy="70" r="52" fill="none" stroke="var(--soft)" stroke-width="18"></circle>' + arcs +
    '<text x="70" y="68" text-anchor="middle" font-size="22" font-weight="800" fill="currentColor">' + tot.toLocaleString("en-PK") + '</text><text x="70" y="86" text-anchor="middle" font-size="11" fill="var(--mute)">parcels</text></svg>' +
    '<div class="legend">' + legend + "</div></div></div>";
}
function rateBars(title, cap, list, cls, avg) {
  const rows = list.map(c => '<div class="hb" data-tip="' + esc(c.city + ": " + c.deliveredPctClosed + "% delivered. " + c.delivered + " delivered, " + c.returned + " returned (" + c.closed + " finished)" + (c.inProcess ? ", " + c.inProcess + " still in process" : "") + (c.deliveredAmount ? ". Delivered " + rs(c.deliveredAmount) + ", returned " + rs(c.returnedAmount) : "")) + '"><span class="hl" title="' + esc(c.city) + '">' + esc(c.city) + '</span><div class="ht"><i class="' + cls + '" style="width:' + c.deliveredPctClosed + '%"></i>' +
    (avg != null ? '<b class="avg" style="left:' + avg + '%"></b>' : "") + '</div><span class="hv">' + c.deliveredPctClosed + '%<small> · ' + c.delivered + "/" + c.closed + "</small></span></div>").join("");
  return '<div class="chart"><h3>' + title + '</h3><p class="cap">' + cap + "</p>" + (rows || '<p class="sub">Not enough cities with ' + MIN_FINISHED + " or more finished parcels yet.</p>") + "</div>";
}
function volumeChart(cities) {
  const top = cities.filter(c => c.booked).slice(0, 10);
  if (!top.length) return "";
  const max = Math.max(...top.map(c => c.booked));
  const rows = top.map(c => '<div class="hb" data-tip="' + esc(c.city + ": " + c.booked + " booked (" + rs(c.bookedAmount) + "). " + c.delivered + " delivered, " + c.returned + " returned, " + c.inProcess + " in process" + (c.deliveredPctClosed == null ? "" : ". " + c.deliveredPctClosed + "% delivered")) + '"><span class="hl" title="' + esc(c.city) + '">' + esc(c.city) + '</span><div><div class="stk" style="width:' + Math.max(4, 100 * c.booked / max) + '%">' +
    (c.delivered ? '<i class="c-del" style="flex:' + c.delivered + '" data-tip="' + esc(c.city + " · Delivered: " + c.delivered) + '"></i>' : "") + (c.returned ? '<i class="c-ret" style="flex:' + c.returned + '" data-tip="' + esc(c.city + " · Returned: " + c.returned) + '"></i>' : "") + (c.inProcess ? '<i class="c-pro" style="flex:' + c.inProcess + '" data-tip="' + esc(c.city + " · In process: " + c.inProcess) + '"></i>' : "") +
    '</div></div><span class="hv">' + c.booked + "<small> · " + (c.deliveredPctClosed == null ? "–" : c.deliveredPctClosed + "%") + "</small></span></div>").join("");
  return '<div class="chart"><h3>Busiest cities</h3><p class="cap">Top ' + top.length + ' cities by parcels booked, split by outcome. Right side: parcels · delivered %</p>' + rows +
    '<div class="key"><span><i class="c-del"></i>Delivered</span><span><i class="c-ret"></i>Returned</span><span><i class="c-pro"></i>In process</span></div></div>';
}

function niceMax(m) { if (m <= 5) return 5; const p = Math.pow(10, Math.floor(Math.log10(m))); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
function dayBars(title, cap, days, series) {
  if (!days.length) return "";
  const W = 760, H = 230, L = 34, B = 34, T = 8, R = 6;
  const max = niceMax(Math.max(1, ...days.map(d => Math.max(...series.map(s => d[s.k] || 0)))));
  const pw = (W - L - R) / days.length, bw = Math.max(1.5, Math.min(26, pw * 0.8 / series.length));
  const y = v => T + (H - T - B) * (1 - v / max);
  let g = "";
  for (let i = 0; i <= 4; i++) { const v = max * i / 4; g += '<line class="g" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(v) + "</text>"; }
  const step = Math.max(1, Math.ceil(days.length / 14));
  let bars = "", lab = "";
  days.forEach((d, i) => {
    const x0 = L + i * pw + (pw - bw * series.length) / 2;
    const dt = new Date(d.day + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    series.forEach((s, j) => { const v = d[s.k] || 0, h = (H - T - B) * v / max;
      bars += '<rect class="' + s.cls + '" x="' + (x0 + j * bw).toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1.5"></rect>'; });
    const all = series.map(s => s.name + ": " + (d[s.k] || 0)).join(" · ");
    bars += '<rect x="' + (L + i * pw).toFixed(1) + '" y="' + T + '" width="' + pw.toFixed(1) + '" height="' + (H - T - B) + '" fill="transparent" data-tip="' + esc(dt + " — " + all) + '"></rect>';
    if (i % step === 0) lab += '<text x="' + (L + i * pw + pw / 2).toFixed(1) + '" y="' + (H - B + 16) + '" text-anchor="middle">' + dt + "</text>";
  });
  const key = series.length > 1 ? '<div class="key">' + series.map(s => '<span><i class="' + s.cls.replace("f-", "c-") + '" style="' + (s.cls === "f-pro" ? "background:#5b7fd6" : "") + '"></i>' + s.name + "</span>").join("") + "</div>" : "";
  return '<div class="chart wide"><h3>' + title + '</h3><p class="cap">' + cap + '</p><svg class="sv" viewBox="0 0 ' + W + " " + H + '" role="img">' + g + bars + lab + "</svg>" + key + "</div>";
}

function stuckChart(d) {
  const e = Object.entries(d.inProcessStatus || {}).sort((a, b) => b[1] - a[1]);
  if (!e.length) return "";
  const issues = new Set(d.issueLabels || []);
  const max = e[0][1], tot = e.reduce((a, x) => a + x[1], 0);
  const rows = e.map(x => '<div class="hb sw" data-tip="' + esc(x[0] + ": " + x[1] + " parcels (" + Math.round(100 * x[1] / tot) + "% of in-process)") + '"><span class="hl" title="' + esc(x[0]) + '">' + esc(x[0]) + '</span><div class="ht"><i class="' + (issues.has(x[0]) ? "c-ret" : "c-pro") + '" style="width:' + Math.max(2, 100 * x[1] / max) + '%"></i></div><span class="hv">' + x[1] + "<small> · " + Math.round(100 * x[1] / tot) + "%</small></span></div>").join("");
  return '<div class="chart wide"><h3>Where in-process parcels are stuck</h3><p class="cap">Latest TCS status of the ' + tot + ' parcels not yet delivered or returned. Red = something needs attention (failed attempt, address or phone problem, hold).</p>' + rows +
    '<div class="key"><span><i class="c-ret"></i>Problem</span><span><i class="c-pro"></i>Normal movement</span></div></div>';
}
function renderCharts() {
  const d = rep.data; if (!d) return;
  const q = d.cities.filter(c => c.closed >= MIN_FINISHED && c.deliveredPctClosed != null)
    .sort((a, b) => b.deliveredPctClosed - a.deliveredPctClosed || b.closed - a.closed);
  const n = Math.min(7, Math.floor(q.length / 2));
  const best = q.slice(0, n), worst = q.slice(q.length - n).reverse();
  const avg = d.totals.deliveredPctClosed;
  const cap = "Cities with " + MIN_FINISHED + "+ finished parcels. Line = overall " + pc(avg) + ". Right side: rate · delivered/finished";
  const dl = d.daily || [];
  $("#repCharts").innerHTML = dayBars("Booked shipments", "Parcels booked with TCS each day (cancelled left out). Hover a bar for the exact count.", dl, [{ k: "booked", name: "Booked", cls: "f-bk" }]) +
    dayBars("In-process, delivered and returned shipments", "Where the parcels booked each day ended up. Hover a bar for the exact count.", dl, [{ k: "inProcess", name: "In process", cls: "f-pro" }, { k: "delivered", name: "Delivered", cls: "f-del" }, { k: "returned", name: "Returned", cls: "f-ret" }]) +
    stuckChart(d) + donutChart(d.totals) + volumeChart(d.cities) +
    rateBars("Highest delivery rate", cap, best, "c-del", avg) + rateBars("Lowest delivery rate", cap, worst, "c-ret", avg);
}

function renderCities() {
  const d = rep.data; if (!d) return;
  const q = ($("#repSearch").value || "").trim().toLowerCase();
  let rows = d.cities.filter(c => c.booked && (!q || c.city.toLowerCase().includes(q)));
  const k = rep.sort, dir = rep.dir;
  rows = rows.slice().sort((a, b) => {
    if (k === "city") return dir * a.city.localeCompare(b.city);
    const av = a[k] == null ? -1 : a[k], bv = b[k] == null ? -1 : b[k];
    return (av - bv) * dir || b.booked - a.booked || a.city.localeCompare(b.city);
  });
  document.querySelectorAll("th[data-sort]").forEach(th => {
    const base = th.textContent.replace(/\s*[▲▼]$/, "");
    th.textContent = base + (th.dataset.sort === k ? (dir > 0 ? " ▲" : " ▼") : "");
  });
  $("#repBody").innerHTML = rows.length ? rows.map(c =>
    "<tr><td>" + esc(c.city) + "</td>" +
    '<td class="num">' + c.booked + '<div class="sub">' + rs(c.bookedAmount) + "</div></td>" +
    '<td class="num">' + c.delivered + "</td>" +
    '<td class="num">' + (c.returned ? '<span class="flag">' + c.returned + "</span>" : 0) + "</td>" +
    '<td class="num">' + (c.inProcess ? '<span data-tip="' + esc(statusLine(c.status)) + '">' + c.inProcess + "</span>" : 0) + "</td>" +
    '<td class="num">' + rs(c.deliveredAmount) + "</td>" +
    '<td class="num">' + (c.returned ? rs(c.returnedAmount) + (c.returnedNoAmount ? ' <span class="sub" data-tip="' + c.returnedNoAmount + ' returned parcel(s) not matched to a Shopify order">*</span>' : "") : "–") + "</td>" +
    "<td>" + (c.deliveredPctClosed == null ? '<span class="sub">None finished yet</span>' : "<strong>" + c.deliveredPctClosed + "%</strong>" +
      '<div class="meter"><i style="width:' + c.deliveredPctClosed + '%"></i></div>') + "</td>" +
    '<td class="num">' + (c.deliveredAmountPct == null ? "–" : "<strong>" + c.deliveredAmountPct + "%</strong>") + "</td></tr>").join("")
    : '<tr><td colspan="9" class="empty">' + (q ? "No city matches your search." : "No parcels booked in this date range.") + "</td></tr>";
}
document.querySelectorAll("th[data-sort]").forEach(th => th.onclick = () => {
  const k = th.dataset.sort;
  if (rep.sort === k) rep.dir = -rep.dir; else { rep.sort = k; rep.dir = k === "city" ? 1 : -1; }
  renderCities();
});
document.querySelectorAll("[data-preset]").forEach(b => b.onclick = () => { applyPreset(b.dataset.preset); runReport(); });
["#repFrom", "#repTo"].forEach(s => $(s).onchange = () => document.querySelectorAll("[data-preset]").forEach(b => b.classList.remove("on")));
$("#repRun").onclick = runReport;
$("#repSearch").oninput = renderCities;

/* ---------- hover help (for customer support) ---------- */
const CHIP_TIPS = {
  "Confirmed": "The customer tapped \"Confirm order\" on WhatsApp. Safe to book.",
  "Awaiting reply": "The WhatsApp confirmation was sent, but the customer hasn't replied yet. Call them if it's urgent.",
  "Customer cancelled": "The customer tapped \"Cancel order\" on WhatsApp. Push all ready skips it. Use Cancel & restock to cancel it in Shopify.",
  "Booking…": "This order is being booked on TCS right now. Wait a moment and refresh.",
  "Last push failed": "The last attempt to book this on TCS failed. Fix the problem shown and push it again.",
  "Pick city": "TCS needs a city from its own list. Choose it in the City box before booking.",
  "Wants delivery again": "The customer tapped \"Deliver again\" on WhatsApp. Ask TCS to attempt delivery again.",
  "Wants to cancel": "The customer tapped \"Cancel order\" on WhatsApp after a failed delivery. Arrange the return with TCS.",
  "Asked, no reply": "We sent the \"couldn't deliver\" WhatsApp message, but the customer hasn't replied. Call them.",
};
const TIPS = [
  ["#waSw", "ON: customers automatically get WhatsApp messages: order confirmation, dispatched with tracking number, out for delivery, and delivery problems. OFF: no messages are sent."],
  ["#auto", "ON: orders are booked on TCS automatically. With WhatsApp messages on, this happens only after the customer confirms. OFF: nothing is booked until you press Push."],
  ["#webSw", "ON: phones/browsers that placed a fake order see \"Order on WhatsApp\" instead of Buy now and Checkout on the website. OFF: nobody is blocked."],
  ["#waOpen", "Check the WhatsApp number and message templates. Only needed when setting up or if messages stop working."],
  ["#refresh", "Reload the latest orders from both stores."],
  ['.tab[data-tab="waiting"]', "New orders not yet booked on TCS. Check details, then push them to TCS."],
  ['.tab[data-tab="problems"]', "Every parcel still in process with TCS. Filter by status or order date, call the customer, then press Mark done."],
  ['.tab[data-tab="marketing"]', "All orders from both stores, grouped into customers. Sort by date, spend or number of orders to pick who to message."],
  ['.tab[data-tab="abandoned"]', "People who started checkout and left their name and phone or email but didn't order. Contact them, then press Mark done."],
  ['.tab[data-tab="blocked"]', "Devices blocked on the website after a fake order. Unblock someone here if they should be allowed to order again."],
  ["#storeFilter", "Show orders from one store or both. Push all ready only books the orders shown."],
  ["#onlyConfWrap", "Ticked: Push all ready only books orders the customer confirmed on WhatsApp. Unticked: it also books orders still awaiting a reply."],
  ["#pushSel", "Book only the ticked orders on TCS. Each gets marked fulfilled and paid in Shopify, and the customer receives the tracking number."],
  ["#pushAll", "Book every order counted as \"ready\" (city chosen, details OK and confirmed) on TCS in one go. You'll be asked to confirm first."],
  ["#all", "Tick or untick all orders shown."],
  ["#pending .sel", "Tick to include this order in Push selected."],
  ["#pending select[data-id]", "TCS city for this parcel. A red border means check it: the city the customer typed didn't match exactly."],
  ["#pending .flag", "The city was matched by a spelling guess. Make sure it's the right city before booking."],
  [".prepaid", "Already paid. Booked with COD Rs 0, so the rider collects nothing."],
  ["#pending td.num", "Cash on delivery: the amount the TCS rider collects from the customer."],
  [".badge.store-house", "Order from the Chitral House store."],
  [".badge.store-herbs", "Order from the Chitral Herbs store."],
  ["[data-conf]", "Send the WhatsApp confirmation message (Confirm / Cancel buttons) to this customer now."],
  ["[data-cancel]", "Use for fake orders only. Cancels the order in Shopify, puts the stock back, doesn't notify the customer, and blocks their device on the website. Can't be undone."],
  ["[data-handled]", "Press after you've dealt with it (called the customer or TCS). It disappears from this list."],
  ['a[href*="tcsexpress.com/track"]', "Open live TCS tracking for this parcel."],
  ['a[href*="/label/"]', "Open the TCS airway bill (label) PDF to print and stick on the parcel."],
  ['a[href^="tel:"]', "Tap to call the customer."],
  ["[data-unblock]", "Let this person order on the website again. It takes effect on their next page load."],
  ["#blkSearch", "Find a blocked person by order number, name or phone number."],
  ["#p-blocked th:nth-child(4)", "How many times this blocked device came back to the website and was stopped."],
  ['.tab[data-tab="delivery"]', "How many of your TCS parcels were delivered or returned, city by city, for any date range you pick."],
  ['.tab[data-tab="total"]', "The delivery ratio of every order placed on one day, from both stores: TCS parcels tracked live plus orders delivered locally in Islamabad and Rawalpindi (ISB/RWP delivery, from the courier sheet) (from the courier sheet)."],
  ["#repRun", "Pull the parcels booked between the two dates from TCS and rebuild the report. Ranges of 3 months or more can take up to a minute."],
  ["#p-delivery th:nth-child(8)", "Delivered ÷ (delivered + returned) by number of parcels. Parcels still on the way are left out until they finish."],
  ["#p-delivery th:nth-child(6)", "COD value of the delivered parcels in this city."],
  ["#p-delivery th:nth-child(7)", "Real order value of returned parcels, read from the Shopify order. * means some returned parcels in that city have no amount and are not counted."],
  ["#p-delivery th:nth-child(9)", "Delivered amount ÷ (delivered + returned amount). Shows how much money, not just how many parcels, came back."],
  ["#waStatus", "Shows whether the WhatsApp number is connected and its quality rating."],
  ["#waTpl", "Shows whether each WhatsApp message template is approved by Meta."],
  ["#waTplNew", "Sends any new message templates to Meta for approval. Existing ones are not changed."],
  ["#codFix", "Lists customers who got the wrong \"Rs 0\" message and lets you send them a correction. Nothing is sent until you confirm."],
  ["#waReg", "Only for first-time setup: connects the WhatsApp number using its 6-digit PIN."],
];
function chipTip(el) {
  const t = el.textContent.trim();
  if (CHIP_TIPS[t]) return CHIP_TIPS[t];
  if (t.startsWith("Booked")) return "Booked on TCS. The order is fulfilled in Shopify and the customer got the tracking number.";
  if (el.classList.contains("bad") && el.closest("#pending")) return "This has to be fixed before the order can be booked. Edit the order in Shopify, then refresh.";
  return "";
}
function applyTips(root) {
  for (const [sel, text] of TIPS) root.querySelectorAll(sel).forEach(el => { if (!el.dataset.tip) el.dataset.tip = text; });
  root.querySelectorAll(".chip").forEach(el => { const t = chipTip(el); if (t) el.dataset.tip = t; });
  root.querySelectorAll('.sub').forEach(el => { if (!el.dataset.tip && /^Typed:/.test(el.textContent)) el.dataset.tip = "The city exactly as the customer typed it at checkout."; });
}
(function () {
  const tip = $("#tip"); let cur = null, timer = null;
  function place(el) {
    const r = el.getBoundingClientRect(); tip.style.left = "0px"; tip.style.top = "0px";
    const w = tip.offsetWidth, h = tip.offsetHeight, vw = innerWidth, vh = innerHeight;
    let x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);
    let y = r.bottom + 8; if (y + h > vh - 8) y = Math.max(8, r.top - h - 8);
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function show(el) { cur = el; clearTimeout(timer); timer = setTimeout(() => { if (cur !== el) return; tip.textContent = el.dataset.tip; place(el); tip.classList.add("on"); }, 350); }
  function hide() { cur = null; clearTimeout(timer); tip.classList.remove("on"); }
  document.addEventListener("mouseover", (e) => { const el = e.target.closest && e.target.closest("[data-tip]"); if (el === cur) return; if (el) show(el); else hide(); });
  document.addEventListener("focusin", (e) => { const el = e.target.closest && e.target.closest("[data-tip]"); if (el && e.target.matches(":focus-visible")) show(el); });
  document.addEventListener("focusout", hide);
  document.addEventListener("mousedown", hide);
  addEventListener("scroll", hide, true);
  applyTips(document);
  let q = false;
  new MutationObserver(() => { if (q) return; q = true; requestAnimationFrame(() => { q = false; applyTips(document); }); })
    .observe(document.body, { childList: true, subtree: true });
})();

/* ---------- load ---------- */
async function load() {
  try {
    const r = await fetch(API); const d = await r.json();
    if (!r.ok) throw new Error(d.error || r.status);
    state = d;
    $("#storeNames").textContent = (d.stores || []).join(" + ");
    renderWaiting(); renderBlocked();
    log((d.storeErrors || []).map(e => e.store + ": " + e.error).join("  ·  "));
  } catch (e) {
    log("Couldn't load orders: " + e.message);
    $("#pending").innerHTML = '<tr><td colspan="7" class="empty">Couldn\'t load orders. Check your connection and refresh.</td></tr>';
  }
}
function loadAll() { load(); }
$("#refresh").onclick = loadAll;
loadAll();
</script>
</body></html>`;
