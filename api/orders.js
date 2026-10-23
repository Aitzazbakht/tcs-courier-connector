// JSON API behind the orders page. /api/orders?key=<CONNECTOR_KEY>
import { createHash, timingSafeEqual } from "node:crypto";
import { keyOk, rawBody, publicBase } from "../lib/auth.js";
import * as sync from "../lib/sync.js";
import * as tcs from "../lib/tcs.js";
import * as shop from "../lib/shopify.js";
import * as wa from "../lib/whatsapp.js";
import * as notify from "../lib/notify.js";
import * as guard from "../lib/guard.js";
import { deliveryReport } from "../lib/report.js";
import { dailyReport } from "../lib/daily.js";
import { inProcess } from "../lib/inprocess.js";
import { listAbandoned, markAbandonedHandled, sendOffer, offerStats } from "../lib/abandoned.js";
import { stores, withStore, splitId } from "../lib/store.js";
import { offerState, sendBatch, offerResults } from "../lib/reoffer.js";
import { startExport, exportStatus, streamStore } from "../lib/marketing.js";
import { profitReport } from "../lib/profit.js";
import { adSpend } from "../lib/ads.js";

const hookAllStores = () => Promise.all(stores().map((st) => withStore(st.key, () => shop.ensureWebhook(`${publicBase()}/api/shopify-webhook${st.key === "house" ? "" : "?store=" + st.key}`)).catch((e) => ({ store: st.label, error: e.message }))));

// The Setup tab PIN lives in the SETUP_PIN environment variable and is never sent to the browser.
const sha = (s) => createHash("sha256").update(String(s)).digest();
async function pinGate(res, pin) {
  const want = String(process.env.SETUP_PIN || "");
  if (!want) { res.status(400).json({ error: "No Setup PIN is set yet. Add SETUP_PIN in Vercel and redeploy." }); return false; }
  if (timingSafeEqual(sha(pin ?? ""), sha(want))) return true;
  await new Promise((r) => setTimeout(r, 800));
  res.status(403).json({ error: "Wrong PIN" });
  return false;
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (!keyOk(url.searchParams.get("key"))) return res.status(403).json({ error: "Forbidden" });
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET" && url.searchParams.get("scopes")) {
      // Which Shopify permissions each store's app currently has, e.g. ?key=..&scopes=1
      const out = {};
      shop.forgetTokens();
      for (const st of stores()) {
        try { out[st.label] = (await withStore(st.key, () => shop.gql(`{ currentAppInstallation { accessScopes { handle } } }`))).currentAppInstallation.accessScopes.map((s) => s.handle).sort(); }
        catch (e) { out[st.label] = "error: " + e.message; }
      }
      return res.status(200).json(out);
    }
    if (req.method === "GET" && url.searchParams.get("explore")) {
      // Read-only peek at TCS inquiry/report/setup endpoints, e.g. ?key=..&explore=/ecom/api/report/loadsheetlogs&fromdate=2026-10-01&todate=2026-10-07
      const params = Object.fromEntries([...url.searchParams].filter(([k]) => !["key", "explore"].includes(k)));
      return res.status(200).json(await tcs.exploreGet(url.searchParams.get("explore"), params));
    }
    if (req.method === "GET") {
      const [pending, booked, cities, auto, waOn, blocked] = await Promise.all([
        sync.listPending(), sync.listRecentBooked(2), sync.cityOptions(), sync.isAutoOn(), notify.isOn(),
        guard.list().catch(() => ({ on: true, rows: [] })),
      ]);
      // Reinstalling an app deletes its webhooks, so make sure they exist whenever the page is opened and they are needed.
      if (auto || waOn) await hookAllStores();
      return res.status(200).json({ auto, waOn, webBlock: blocked.on, blocked: blocked.rows, pending, booked, cities, stores: stores().map((s) => s.label), storeErrors: sync.listPending.errors || [] });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Use GET or POST" });
    const body = JSON.parse((await rawBody(req)).toString("utf8") || "{}");

    if (body.action === "push") {
      const [code, name] = String(body.city || body.city_code || "").split("|");
      const r = await sync.pushOrder(body.id, { cityCode: code || undefined, cityName: name || undefined, force: !!body.force });
      return res.status(200).json(r);
    }
    if (body.action === "blocked_list") {
      return res.status(200).json(await guard.list());
    }
    if (body.action === "unblock") {
      return res.status(200).json(await guard.unblock(Array.isArray(body.ids) ? body.ids : []));
    }
    if (body.action === "web_block") {
      return res.status(200).json({ webBlock: await guard.setOn(body.value === true) });
    }
    if (body.action === "cancel_fake") {
      return res.status(200).json(await sync.cancelFakeOrder(body.id));
    }
    if (body.action === "delivery_report") {
      return res.status(200).json(await deliveryReport(String(body.from || ""), String(body.to || "")));
    }
    if (body.action === "daily_report") {
      return res.status(200).json(await dailyReport(String(body.date || ""), { refresh: body.refresh === true, to: String(body.to || "") }));
    }
    if (body.action === "mk_offers") return res.status(200).json(await offerState());
    if (body.action === "mk_send") return res.status(200).json(await sendBatch(Array.isArray(body.items) ? body.items : [], { days: body.days, cap: body.cap, testTo: String(body.testTo || ""), image: body.image !== false, group: String(body.group || "") }));
    if (body.action === "mk_results") return res.status(200).json(await offerResults());
    if (body.action === "mk_start") return res.status(200).json(await startExport(Math.max(0, Math.min(3650, Number(body.days) || 0))));
    if (body.action === "mk_status") return res.status(200).json(await exportStatus());
    if (body.action === "mk_data") return await streamStore(String(body.store || ""), res);
    if (body.action === "abandoned") return res.status(200).json(await listAbandoned(String(body.from || ""), String(body.to || "")));
    if (body.action === "abandoned_stats") return res.status(200).json(await offerStats(String(body.from || ""), String(body.to || "")));
    if (body.action === "abandoned_offer") return res.status(200).json(await sendOffer(String(body.id || ""), { testTo: String(body.testTo || "") }));
    if (body.action === "abandoned_handled") return res.status(200).json(await markAbandonedHandled(String(body.id || "")));
    if (body.action === "in_process") return res.status(200).json(await inProcess({ refresh: body.refresh === true }));
    if (body.action === "problems") {
      return res.status(200).json({ problems: await notify.listProblems() });
    }
    if (body.action === "problem_handled") {
      return res.status(200).json(await notify.markProblemHandled(body.id));
    }
    if (body.action === "setup_unlock") {
      if (!(await pinGate(res, body.pin))) return;
      return res.status(200).json({ ok: true });
    }
    if (body.action === "profit_report") {
      // Everything on the Setup tab checks the PIN again on the server, so the data can't be fetched without it.
      if (!(await pinGate(res, body.pin))) return;
      return res.status(200).json(await profitReport({
        date: String(body.date || ""), ship: String(body.ship || ""),
        ads: body.ads && typeof body.ads === "object" ? body.ads : {}, refresh: body.refresh === true,
      }));
    }
    if (body.action === "ad_spend") {
      if (!(await pinGate(res, body.pin))) return;
      return res.status(200).json(await adSpend(String(body.date || "")));
    }
    if (body.action === "env_check") {
      const names = ["CONNECTOR_KEY", "TCS_BEARER_TOKEN", "TCS_USERNAME", "TCS_PASSWORD", "TCS_ENV",
        "SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET", "SHOPIFY_CLIENT_ID_HERBS", "SHOPIFY_CLIENT_SECRET_HERBS",
        "WHATSAPP_TOKEN", "WHATSAPP_APP_SECRET", "CRON_SECRET", "SHOPIFY_SHOP", "SHOPIFY_SHOP_HERBS"];
      return res.status(200).json(Object.fromEntries(names.map((n) => [n, process.env[n] ? `set (${String(process.env[n]).length} chars)` : "missing"])));
    }
    if (body.action === "stores_check") {
      const info = await Promise.all(stores().map((st) => withStore(st.key, async () => {
        try { const d = await shop.gql("query { shop { name myshopifyDomain } }"); return { store: st.label, ok: true, shop: d.shop }; }
        catch (e) { return { store: st.label, ok: false, error: e.message }; }
      })));
      const [auto, waOn] = await Promise.all([sync.isAutoOn(), notify.isOn()]);
      const webhooks = auto || waOn ? await hookAllStores() : "not needed (auto-book and WhatsApp are off)";
      return res.status(200).json({ stores: info, webhooks });
    }
    if (body.action === "wa_toggle") {
      const on = !!body.value;
      if (on) await hookAllStores();
      await shop.setSetting("wa_messages", on ? "true" : "false");
      return res.status(200).json({ waOn: on });
    }
    if (body.action === "wa_confirm_send") {
      const { store, gid } = splitId(body.id);
      return res.status(200).json(await withStore(store, async () => notify.sendConfirm(await shop.getOrder(gid))));
    }
    if (body.action === "wa_tracking_run") {
      return res.status(200).json(await notify.runTracking({ dryRun: !!body.dryRun }));
    }
    if (body.action === "cod_fix") {
      return res.status(200).json(await notify.codCorrection({ send: body.send === true }));
    }
    if (body.action === "wa_templates_create") {
      return res.status(200).json({ ok: true, templates: await wa.createTemplates() });
    }
    if (body.action === "wa_templates") {
      return res.status(200).json({ ok: true, templates: await wa.listTemplates() });
    }
    if (body.action === "wa_status") {
      return res.status(200).json({ ok: true, phone: await wa.phoneStatus() });
    }
    if (body.action === "wa_register") {
      if (!/^\d{6}$/.test(String(body.pin || ""))) return res.status(400).json({ error: "PIN must be 6 digits" });
      const r = await wa.register(body.pin);
      let sub = null; try { sub = await wa.subscribeApp(); } catch (e) { sub = { error: e.message }; }
      return res.status(200).json({ ok: true, register: r, subscribe: sub, phone: await wa.phoneStatus().catch(() => null) });
    }
    if (body.action === "auto") {
      const on = !!body.value;
      let webhook = null;
      if (on) webhook = await hookAllStores();
      await shop.setSetting("auto_book", on ? "true" : "false");
      return res.status(200).json({ auto: on, webhook });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
