// Storefront device guard.
//   /g.js?s=house        -> the small script the theme loads (cached)
//   /api/guard?d=<code>  -> { b: true|false } is this device blocked
import * as guard from "../lib/guard.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (url.searchParams.get("js")) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).send(SCRIPT);
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    return res.status(200).json(await guard.check(url.searchParams.get("d"), url.searchParams.get("h") === "1"));
  } catch {
    return res.status(200).json({ b: false }); // never block on errors
  }
}

// Plain ES5-ish browser code. No backticks or ${} inside (this is a template literal).
const SCRIPT = String.raw`(function () {
  if (window.__chGuard) return; window.__chGuard = 1;
  var me = document.currentScript, base = me ? new URL(me.src).origin : "";
  var K = "_chd", BK = "_chd_b", id = null, state = "pending", waiters = [], wa = "";
  var SEL = ".shopify-payment-button, shopify-accelerated-checkout, shopify-accelerated-checkout-cart, .additional-checkout-buttons, .dynamic-checkout__content, .button-checkout, [name=checkout], #cart-checkout, #cart-sidebar-checkout, a[href$='/checkout'], a[href*='/checkout?']";
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} return null; }
  function ck(n) { var m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; }
  var ok = function (v) { return /^[a-z0-9]{10,40}$/.test(v || ""); };

  id = ls(K); if (!ok(id)) id = ck(K);
  if (!ok(id)) {
    var a = new Uint8Array(12); try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < 12; i++) a[i] = Math.random() * 256; }
    id = "d"; for (var j = 0; j < a.length; j++) id += (a[j] % 36).toString(36);
  }
  ls(K, id);
  try { document.cookie = K + "=" + id + "; path=/; max-age=63072000; SameSite=Lax; domain=" + location.hostname.replace(/^www\./, ""); } catch (e) {}

  /* blocked look: hide checkout buttons, show WhatsApp instead */
  var css = document.createElement("style");
  css.textContent = "html.ch-blk " + SEL.split(",").join(", html.ch-blk ") + "{display:none!important}" +
    ".ch-wa{display:block;width:100%;margin:10px 0;padding:14px 16px;border-radius:6px;background:#1f8f4e;color:#fff!important;text-align:center;font-weight:700;text-decoration:none!important}" +
    ".ch-wa-note{font-size:13px;opacity:.75;text-align:center;margin:-4px 0 8px}";
  (document.head || document.documentElement).appendChild(css);
  function waHref() { return "https://wa.me/" + (wa || "") + "?text=" + encodeURIComponent("Assalam o Alaikum, I want to place an order."); }
  function addWa() {
    if (state !== "blocked") return;
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.parentElement && el.parentElement.closest && el.parentElement.closest(SEL)) continue;
      if (el.nextElementSibling && el.nextElementSibling.className === "ch-wa-box") continue;
      var box = document.createElement("div"); box.className = "ch-wa-box";
      box.innerHTML = '<a class="ch-wa" target="_blank" rel="noopener" href="' + waHref() + '">Order on WhatsApp</a><div class="ch-wa-note">Online checkout is not available on this device. Please order on WhatsApp.</div>';
      el.parentNode.insertBefore(box, el.nextSibling);
    }
  }
  function setBlocked(b) {
    state = b ? "blocked" : "ok";
    document.documentElement.classList[b ? "add" : "remove"]("ch-blk");
    if (b) { ls(BK, "1"); addWa(); } else { ls(BK, null); var x = document.querySelectorAll(".ch-wa-box"); for (var i = 0; i < x.length; i++) x[i].remove(); }
    var w = waiters; waiters = []; for (var k = 0; k < w.length; k++) w[k]();
  }
  wa = ls("_chd_w") || "";
  if (ls(BK) === "1") { document.documentElement.classList.add("ch-blk"); state = "blocked"; }

  /* ask the server once per visit; any error = not blocked */
  var asked = ss("_chd_s");
  if (asked === "ok" && state !== "blocked") state = "ok";
  else {
    var t = setTimeout(function () { if (state === "pending") setBlocked(false); }, 4000);
    fetch(base + "/api/guard?d=" + id + "&h=" + (asked ? "0" : "1"), { credentials: "omit" })
      .then(function (r) { return r.json(); })
      .then(function (d) { clearTimeout(t); if (d.wa) { wa = d.wa; ls("_chd_w", wa); } ss("_chd_s", d.b ? "b" : "ok"); setBlocked(!!d.b); })
      .catch(function () { clearTimeout(t); if (state === "pending") setBlocked(false); });
  }

  /* a click on checkout / buy now while blocked, or before the answer arrives */
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest(SEL) : null;
    if (!el || window.__chPass) return;
    var tgt = (e.target.closest && e.target.closest("button, a, input[type=submit]")) || e.target;
    if (state === "ok") return markCart();
    e.preventDefault(); e.stopImmediatePropagation();
    if (state === "blocked") { addWa(); return; }
    var go = function () { if (state === "ok") { window.__chPass = 1; tgt.click(); window.__chPass = 0; } else addWa(); };
    waiters.push(go); setTimeout(function () { if (state === "pending") { state = "ok"; go(); } }, 1500);
  }, true);
  document.addEventListener("submit", function (e) {
    var f = e.target; if (!f || state !== "blocked") return;
    var btn = e.submitter; if ((btn && btn.name === "checkout") || /\/checkout/.test(f.getAttribute("action") || "")) { e.preventDefault(); e.stopImmediatePropagation(); addWa(); }
  }, true);

  /* attach the device code to orders: hidden line-item property (works with Buy now) + cart attribute */
  function tagForms() {
    var fs = document.querySelectorAll("form[action*='/cart/add']");
    for (var i = 0; i < fs.length; i++) {
      if (fs[i].querySelector("input[name='properties[_chd]']")) continue;
      var inp = document.createElement("input"); inp.type = "hidden"; inp.name = "properties[_chd]"; inp.value = id; fs[i].appendChild(inp);
    }
  }
  function markCart() {
    var c = ck("cart"); if (!c || ss("_chd_c") === c) return;
    ss("_chd_c", c);
    try { fetch("/cart/update.js", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attributes: { _chd: id } }), keepalive: true }).catch(function () {}); } catch (e) {}
  }
  var queued = false;
  function tick() { queued = false; tagForms(); markCart(); addWa(); }
  function later() { if (!queued) { queued = true; setTimeout(tick, 300); } }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick); else tick();
  try { new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
})();`;
