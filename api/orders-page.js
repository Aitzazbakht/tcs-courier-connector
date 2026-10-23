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
header.top{background:#15211D;color:#E6ECE9;border-bottom:1px solid #0E1613;position:sticky;top:0;z-index:30;height:56px}
.bar{display:flex;align-items:center;gap:10px;padding:0 16px;height:56px}
.brand{font-weight:800;font-size:17px;letter-spacing:-.01em;margin-right:auto;display:flex;align-items:center;gap:10px}
.brand span{color:#93A09B;font-weight:500;font-size:13px;margin-left:2px}
.logoimg{height:38px;width:auto;display:block}
.logo{width:30px;height:30px;border-radius:9px;background:#6FC39A;color:#0D1A14;display:grid;place-items:center;font-style:normal;font-weight:800}
.btn.menu-btn{display:none}
header.top .bar .ctrl,header.top .bar .btn{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.16);color:#E6ECE9}
header.top .bar .ctrl:hover,header.top .bar .btn:hover{border-color:rgba(255,255,255,.4)}
header.top .switch{background:rgba(255,255,255,.22)}
header.top .ctrl[aria-checked="true"] .switch{background:#6FC39A}
.shell{display:flex;align-items:flex-start}
.content{flex:1;min-width:0}
.side{width:256px;flex:none;position:sticky;top:56px;height:calc(100vh - 56px);overflow-y:auto;background:#1B2925;color:#C9D4CF;padding:14px 12px;border-right:1px solid #0E1613}
.sidehead{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#7F8E88;padding:4px 12px 10px}
.scrim{display:none}
.dgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}
.dcard{display:flex;flex-direction:column;justify-content:flex-start;text-align:left;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 18px;cursor:pointer;color:inherit}
.dcard:hover{border-color:var(--pine)}
.dcard .dh{display:flex;align-items:center;justify-content:space-between;color:var(--mute);font-weight:700;font-size:13px;margin-bottom:6px}
.dcard .dv{font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1.15}
.dcard .dv.ok{color:var(--pine)}.dcard .dv.bad{color:var(--rust)}
.dcard .dl{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--mute);padding:3px 0;border-top:1px solid var(--soft)}
.dcard .dl:first-of-type{margin-top:10px}
.dcard .dl b{color:var(--ink);font-weight:700}
.dashempty{background:var(--surface);border:1px dashed var(--line);border-radius:14px;padding:60px 20px;text-align:center;color:var(--mute)}
.dashempty h2{margin:0 0 6px;color:var(--ink)}
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

/* sidebar menu */
nav.tabs{display:flex;flex-direction:column;gap:3px}
.tab{border:0;background:none;padding:10px 12px;cursor:pointer;color:#C9D4CF;border-radius:10px;display:flex;align-items:center;gap:12px;font-weight:600;text-align:left;width:100%}
.tab .tl{flex:1;min-width:0}
.tab .ti{flex:none;opacity:.85}
.tab:hover{background:rgba(255,255,255,.07)}
.tab b{font-size:12px;font-weight:700;background:rgba(255,255,255,.12);color:#E6ECE9;border-radius:999px;padding:1px 9px;line-height:1.6}
.tab[aria-selected="true"]{background:#6FC39A;color:#0D1A14}
.tab[aria-selected="true"] .ti{opacity:1}
.tab[aria-selected="true"] b{background:rgba(13,26,20,.16);color:#0D1A14}
.tab.alert b{background:var(--rust);color:#fff}

#log{min-height:20px;font-size:13px;color:var(--mute);padding:8px 0 0}

/* WhatsApp setup popover */
#waPanel{display:none;position:absolute;right:16px;top:62px;width:min(380px,calc(100vw - 40px));background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;box-shadow:0 12px 32px rgba(28,40,38,.14);z-index:20}
#waPanel.open{display:block;color:var(--ink)}
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
  #waPanel{right:14px}
}
@media (max-width:1100px){
  .bar{overflow-x:auto;scrollbar-width:none}
  .ctrl{flex:none}
}
@media (max-width:900px){
  .btn.menu-btn{display:grid}
  .side{position:fixed;left:0;top:56px;z-index:40;transform:translateX(-100%);transition:transform .18s;width:260px}
  .side.open{transform:none}
  .scrim.on{display:block;position:fixed;inset:56px 0 0 0;background:rgba(0,0,0,.45);z-index:35}
  .brand{margin-right:auto;flex:none}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head>
<body>
<header class="top">
  <div class="bar">
    <button class="btn icon-btn menu-btn" id="menuBtn" aria-label="Menu" aria-controls="side"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    <div class="brand"><img class="logoimg" src="data:image/png;base64,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" alt="Chitral House"><span id="storeNames" hidden>Chitral House</span></div>
    <button class="ctrl" id="waSw" role="switch" aria-checked="false">WhatsApp messages <span class="switch"></span></button>
    <button class="ctrl" id="auto" role="switch" aria-checked="false">Auto-book <span class="switch"></span></button>
    <button class="ctrl" id="webSw" role="switch" aria-checked="true">Website blocking <span class="switch"></span></button>
    <button class="btn icon-btn" id="waOpen" aria-expanded="false" aria-controls="waPanel" aria-label="WhatsApp setup" data-tip="WhatsApp setup"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>
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
</header>
<div class="shell">
<aside class="side" id="side">
  <div class="sidehead">Menu</div>
  <nav class="tabs" role="tablist" aria-orientation="vertical">
    <button class="tab" role="tab" data-tab="dashboard" aria-selected="false"><svg class="ti" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg><span class="tl">Dashboard</span></button>
    <button class="tab" role="tab" data-tab="waiting" aria-selected="false"><svg class="ti" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg><span class="tl">Waiting to book</span><b id="cWaiting">–</b></button>
    <button class="tab" role="tab" data-tab="problems" aria-selected="false"><svg class="ti" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg><span class="tl">Delivery problems</span><b id="cProblems">–</b></button>
    <button class="tab" role="tab" data-tab="abandoned" aria-selected="false"><svg class="ti" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/><path d="M2 3h3l2.5 12h11L21 7H6"/></svg><span class="tl">Abandoned carts</span><b id="cAband">–</b></button>
    <button class="tab" role="tab" data-tab="marketing" aria-selected="false"><svg class="ti" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M16 8a5 5 0 0 1 0 8"/></svg><span class="tl">Marketing Workflow</span><b id="cMk">–</b></button>
    <button class="tab" role="tab" data-tab="blocked" aria-selected="false"><svg class="ti" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg><span class="tl">Blocked</span><b id="cBlocked">–</b></button>
    <button class="tab" role="tab" data-tab="delivery" aria-selected="false"><svg class="ti" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg><span class="tl">TCS delivery report</span><b id="cDelivery">–</b></button>
    <button class="tab" role="tab" data-tab="total" aria-selected="false"><svg class="ti" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg><span class="tl">Total delivery report</span><b id="cTotal">–</b></button>
  </nav>
</aside>
<div class="scrim" id="scrim"></div>
<div class="content">
<main class="wrap">
  <div id="log" aria-live="polite"></div>

  <section class="panel" id="p-dashboard" hidden>
    <div class="toolbar">
      <label class="field">From <input type="date" id="dFrom"></label>
      <label class="field">To <input type="date" id="dTo"></label>
      <div class="seg" id="dPreset"><button data-d="0">Today</button><button data-d="1">Yesterday</button><button data-d="7">7 days</button><button data-d="30">30 days</button></div>
      <button class="btn" id="dRun">Refresh</button>
      <span class="sub" id="dMeta"></span>
    </div>
    <div class="dgrid" id="dGrid"></div>
  </section>

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
      <label class="field">Last order <select id="mkLast"><option value="any">Any time</option><option value="0-30">Within 30 days</option><option value="30-90">30 to 90 days ago</option><option value="90+">Over 90 days ago</option></select></label>
      <label class="field">Offer <select id="mkOffer"><option value="all">Any</option><option value="none">Not sent yet</option><option value="sent">Already sent</option></select></label>
      <label class="field"><input type="search" id="mkSearch" placeholder="Search name, phone or order"></label>
    </div>
    <div class="toolbar" id="mkOfferBar">
      <label class="field">Group name <input type="text" id="mkGroupName" maxlength="40" placeholder="e.g. Last order 30-90 days" style="width:200px;border:1px solid var(--line);border-radius:8px;padding:6px 9px;background:var(--surface);color:var(--ink)"></label>
      <label class="field">Daily limit <input type="number" id="mkCap" min="1" max="2000" value="1500" style="width:80px;border:1px solid var(--line);border-radius:8px;padding:6px 9px;background:var(--surface);color:var(--ink)"></label>
      <label class="field">Message <select id="mkTpl"><option value="img">With picture (ch_reorder_offer_img)</option><option value="text">Text only (ch_reorder_offer)</option></select></label>
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
</div></div>
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

let dash = { cards: {}, seq: 0 };
function dashDay(n) { return new Date(Date.now() + 5 * 3600e3 - n * 86400000).toISOString().slice(0, 10); }
function dashSet(n) { $("#dFrom").value = n === 1 ? dashDay(1) : dashDay(n === 0 ? 0 : n - 1); $("#dTo").value = n === 1 ? dashDay(1) : dashDay(0); }
function ensureDash() { if (!$("#dFrom").value) dashSet(7); if (!dash.loaded) runDash(); }
function dcard(go, title, big, cls, lines) {
  return '<button class="dcard" data-go="' + go + '"><div class="dh"><span>' + esc(title) + '</span><span>Open &rarr;</span></div><div class="dv ' + (cls || "") + '">' + big + "</div>" +
    lines.map(l => '<div class="dl"><span>' + esc(l[0]) + "</span><b>" + l[1] + "</b></div>").join("") + "</button>";
}
function dashPaint() {
  const c = dash.cards, order = ["waiting", "delivery", "total", "problems", "abandoned", "blocked", "marketing"];
  $("#dGrid").innerHTML = order.map(k => c[k] || "").join("");
  document.querySelectorAll("#dGrid .dcard").forEach(b => b.onclick = () => showTab(b.dataset.go));
}
function dashPut(k, html) { dash.cards[k] = html; dashPaint(); }
function dashLoading(k, title, go) { dashPut(k, dcard(go, title, "…", "", [["Loading", ""]])); }
function dashFail(k, title, go, e) { dashPut(k, dcard(go, title, "–", "", [["Couldn't load", esc(e && e.message || "error")]])); }
async function runDash() {
  const a = $("#dFrom").value, b = $("#dTo").value || a;
  if (!a) return; if (b < a) return log("The end date is before the start date.");
  dash.loaded = true; const my = ++dash.seq; const ok = () => my === dash.seq; dash.cards = {};
  $("#dMeta").textContent = a + (b !== a ? " to " + b : "");
  const inR = (iso) => iso && pkDay(iso) >= a && pkDay(iso) <= b;
  const n = (x) => Number(x || 0).toLocaleString("en-PK");
  // instant ones from data already on the page
  const pend = (state.pending || []).filter(o => inR(o.createdAt));
  dashPut("waiting", dcard("waiting", "Waiting to book", n(pend.length), pend.length ? "bad" : "", [["All waiting orders now", n((state.pending || []).length)]]));
  const blk = (state.blocked || []).filter(r => inR(r.at));
  dashPut("blocked", dcard("blocked", "Blocked devices", n(blk.length), "", [["Blocked in total", n((state.blocked || []).length)]]));
  const mkIn = mk.rows.filter(o => inR(o.d));
  dashPut("marketing", mk.rows.length ? dcard("marketing", "Marketing orders", n(mkIn.length), "", [["Orders loaded in total", n(mk.rows.length)]]) : dcard("marketing", "Marketing orders", "–", "", [["Open the tab once to load all orders", ""]]));
  dashLoading("delivery", "TCS delivery report", "delivery"); dashLoading("total", "Total delivery ratio", "total");
  dashLoading("problems", "Delivery problems", "problems"); dashLoading("abandoned", "Abandoned carts", "abandoned");
  post({ action: "delivery_report", from: a, to: b }).then(d => { if (!ok()) return; const t = d.totals;
    dashPut("delivery", dcard("delivery", "TCS delivery report", t.deliveredPctClosed == null ? "–" : Math.round(t.deliveredPctClosed) + "%", "ok", [["Booked", n(t.booked)], ["Delivered", n(t.delivered)], ["Returned", n(t.returned)], ["In process", n(t.inProcess)]]));
  }).catch(e => ok() && dashFail("delivery", "TCS delivery report", "delivery", e));
  post({ action: "abandoned", from: a, to: b }).then(async d => { if (!ok()) return;
    const open = d.rows.filter(r => !r.handled).length; let st = null; try { st = await post({ action: "abandoned_stats", from: a, to: b }); } catch (e) {}
    if (!ok()) return;
    dashPut("abandoned", dcard("abandoned", "Abandoned carts", n(d.rows.length), "", [["To follow up", n(open)], ["Handled", n(d.rows.length - open)]].concat(st ? [["10% offers sent", n(st.sent)], ["Recovered", n(st.recovered)]] : [])));
  }).catch(e => ok() && dashFail("abandoned", "Abandoned carts", "abandoned", e));
  post({ action: "in_process", refresh: false }).then(d => { if (!ok()) return;
    const rows = d.rows.filter(r => inR(r.createdAt)), need = rows.filter(r => r.issue && !r.handled).length;
    dashPut("problems", dcard("problems", "Delivery problems", n(rows.length), need ? "bad" : "", [["In process (orders in range)", n(rows.length)], ["Need a call", n(need)], ["In process, all dates", n(d.rows.length)]]));
  }).catch(e => ok() && dashFail("problems", "Delivery problems", "problems", e));
  post({ action: "daily_report", date: a, to: b, refresh: false }).then(d => { if (!ok()) return; const t = d.totals;
    dashPut("total", dcard("total", "Total delivery ratio", t.ratio == null ? "–" : Math.round(t.ratio) + "%", "ok", [["Orders counted", n(t.counted)], ["Delivered", n(t.delivered)], ["Cancelled (not counted)", n(t.cancelled)]]));
  }).catch(e => ok() && dashFail("total", "Total delivery ratio", "total", e));
}

/* ---------- tabs ---------- */
function showTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
  $("#side").classList.remove("open"); $("#scrim").classList.remove("on");
  document.querySelectorAll(".panel").forEach(p => p.hidden = p.id !== "p-" + name);
  try { history.replaceState(null, "", "#" + name); } catch (e) {}
  if (name === "dashboard") ensureDash();
  if (name === "delivery") ensureReport();
  if (name === "total") ensureTotal();
  if (name === "problems") ensureProblems();
  if (name === "abandoned") ensureAband();
  if (name === "marketing") ensureMarketing();
}
document.querySelectorAll(".tab").forEach(t => t.onclick = () => showTab(t.dataset.tab));
document.querySelectorAll("#dPreset button").forEach(b => b.onclick = () => { dashSet(Number(b.dataset.d)); runDash(); });
$("#dRun").onclick = () => runDash(); $("#dFrom").onchange = () => { if ($("#dTo").value < $("#dFrom").value) $("#dTo").value = $("#dFrom").value; runDash(); }; $("#dTo").onchange = () => runDash();
$("#menuBtn").onclick = () => { const o = $("#side").classList.toggle("open"); $("#scrim").classList.toggle("on", o); };
$("#scrim").onclick = () => { $("#side").classList.remove("open"); $("#scrim").classList.remove("on"); };
showTab(["dashboard", "waiting", "problems", "abandoned", "marketing", "blocked", "delivery", "total"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "waiting");

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
    ? [["spend", "Highest total spent"], ["orders", "Most orders"], ["avg", "Highest average order"], ["recent", "Newest order"], ["oldest", "Oldest order"], ["name", "Name A–Z"], ["random", "Random order"]]
    : [["recent", "Newest first"], ["oldest", "Oldest first"], ["amount", "Highest amount"], ["name", "Name A–Z"]];
  const cur = $("#mkSort").value;
  $("#mkSort").innerHTML = o.map(x => '<option value="' + x[0] + '">' + x[1] + "</option>").join("");
  if (o.some(x => x[0] === cur)) $("#mkSort").value = cur; else $("#mkSort").value = mk.view === "customers" ? "spend" : "recent";
}
// stable random order for this page load, so the list does not reshuffle on every filter change
const mkRndMap = {};
function mkRnd(k) { return mkRndMap[k] === undefined ? (mkRndMap[k] = Math.random()) : mkRndMap[k]; }
function mkLastOk(x) {
  const f = $("#mkLast").value; if (f === "any") return true;
  const age = (Date.parse(pkDay(new Date().toISOString())) - Date.parse(pkDay(x.last))) / 86400000;
  return f === "0-30" ? age <= 30 : f === "30-90" ? age > 30 && age <= 90 : age > 90;
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
    let list = c.all.filter(x => c.okC(x) && c.hit(x.name + " " + x.phone) && (of === "all" || (of === "sent") === !!mk.offers[x.phone]) && mkLastOk(x));
    const by = { spend: (x, y) => y.spent - x.spent, orders: (x, y) => y.orders - x.orders || y.spent - x.spent, avg: (x, y) => y.spent / y.orders - x.spent / x.orders, recent: (x, y) => (y.last > x.last ? 1 : -1), oldest: (x, y) => (x.last > y.last ? 1 : -1), name: (x, y) => String(x.name).localeCompare(String(y.name)), random: (x, y) => mkRnd(x.key) - mkRnd(y.key) };
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
  const grp = $("#mkGroupName").value.trim();
  if (!grp) return log("Type a Group name first (for example: Last order 30-90 days), so the results can be compared by group.");
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
      const d = await post({ action: "mk_send", items: batch, days, cap, image: $("#mkTpl").value === "img", group: grp });
      d.results.forEach(r => { if (r.ok) ok++; else if (r.skipped) skip++; else { fail++; if (fail <= 3) log("Couldn't send to " + r.phone + ": " + r.error); } });
      await loadMkOffers();
      if (fail >= 10 && ok === 0) { log("Stopped: the first sends all failed. Check that the template is approved."); break; }
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
  try { const d = await post({ action: "mk_send", items: [{ phone: x.phone, name: x.name, store: x.store }], days: Number($("#mkDays2").value) || 14, testTo: to, image: $("#mkTpl").value === "img" }); const r = d.results[0]; log(r.ok ? "Test sent. Link: " + r.link : "Couldn't send the test: " + (r.error || r.skipped)); }
  catch (e) { log("Couldn't send the test: " + e.message); }
};
$("#mkResBtn").onclick = async () => {
  $("#mkResults").innerHTML = '<p class="note">Checking which codes were used…</p>';
  try {
    const d = await post({ action: "mk_results" });
    const rows = d.orders.map(o => "<tr><td><strong>" + esc(o.name) + '</strong><div class="sub">' + esc(o.store) + "</div></td><td>" + esc(o.customer) + "</td><td>" + when(o.at) + '</td><td class="n">' + rs(o.amount) + '</td><td class="n">' + rs(o.discount) + "</td></tr>").join("");
    $("#mkResults").innerHTML = '<div class="tbox"><h3>How the 10% offers worked</h3>' + '<table><tr><th>Group</th><th class="n">Sent</th><th class="n">Used</th><th class="n">Rate</th><th class="n">Sales</th><th class="n">Discount</th></tr>' + (d.groups || []).map(g => "<tr><td><strong>" + esc(g.name) + '</strong></td><td class="n">' + g.sent + '</td><td class="n">' + g.used + '</td><td class="n"><strong>' + g.rate + '%</strong></td><td class="n">' + rs(g.revenue) + '</td><td class="n">' + rs(g.discount) + "</td></tr>").join("") + '</table><table style="margin-top:8px"><tr><td>Offers sent (all groups)</td><td class="n">' + d.sent + '</td></tr><tr><td>Codes used on an order</td><td class="n"><strong>' + d.used + "</strong>" + (d.sent ? " (" + (100 * d.used / d.sent).toFixed(1) + "%)" : "") + '</td></tr><tr><td>Sales from these orders</td><td class="n"><strong>' + rs(d.revenue) + '</strong></td></tr><tr><td>Discount given</td><td class="n">' + rs(d.discount) + "</td></tr></table>" +
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
["#mkPeriod", "#mkGroup", "#mkLast", "#mkSort", "#mkLimit", "#mkStore", "#mkFrom", "#mkTo"].forEach(id => { $(id).onchange = () => { if (id === "#mkPeriod") $("#mkCustom").hidden = $("#mkPeriod").value !== "custom"; mk.shown = 100; mkRender(); }; });
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
  ['.tab[data-tab="dashboard"]', "One overview of every tab for the date range you pick. Click a card to open that tab."],
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
    if (dash.loaded && !$("#p-dashboard").hidden) runDash();
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
