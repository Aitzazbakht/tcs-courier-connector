// JSON API behind the orders page. /api/orders?key=<CONNECTOR_KEY>
import { keyOk, rawBody, publicBase } from "../lib/auth.js";
import * as sync from "../lib/sync.js";
import * as shop from "../lib/shopify.js";
import * as wa from "../lib/whatsapp.js";
import * as notify from "../lib/notify.js";
import { stores, withStore, splitId } from "../lib/store.js";

const hookAllStores = () => Promise.all(stores().map((st) => withStore(st.key, () => shop.ensureWebhook(`${publicBase()}/api/shopify-webhook${st.key === "house" ? "" : "?store=" + st.key}`)).catch((e) => ({ store: st.label, error: e.message }))));

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (!keyOk(url.searchParams.get("key"))) return res.status(403).json({ error: "Forbidden" });
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const [pending, booked, cities, auto, waOn] = await Promise.all([
        sync.listPending(), sync.listRecentBooked(30), sync.cityOptions(), sync.isAutoOn(), notify.isOn(),
      ]);
      return res.status(200).json({ auto, waOn, pending, booked, cities, stores: stores().map((s) => s.label), storeErrors: sync.listPending.errors || [] });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Use GET or POST" });
    const body = JSON.parse((await rawBody(req)).toString("utf8") || "{}");

    if (body.action === "push") {
      const [code, name] = String(body.city || body.city_code || "").split("|");
      const r = await sync.pushOrder(body.id, { cityCode: code || undefined, cityName: name || undefined, force: !!body.force });
      return res.status(200).json(r);
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
