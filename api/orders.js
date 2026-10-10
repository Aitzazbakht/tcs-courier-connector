// JSON API behind the orders page. /api/orders?key=<CONNECTOR_KEY>
import { keyOk, rawBody, publicBase } from "../lib/auth.js";
import * as sync from "../lib/sync.js";
import * as shop from "../lib/shopify.js";
import * as wa from "../lib/whatsapp.js";
import * as notify from "../lib/notify.js";

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
      return res.status(200).json({ auto, waOn, pending, booked, cities });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Use GET or POST" });
    const body = JSON.parse((await rawBody(req)).toString("utf8") || "{}");

    if (body.action === "push") {
      const [code, name] = String(body.city || body.city_code || "").split("|");
      const r = await sync.pushOrder(body.id, { cityCode: code || undefined, cityName: name || undefined, force: !!body.force });
      return res.status(200).json(r);
    }
    if (body.action === "wa_toggle") {
      const on = !!body.value;
      if (on) await shop.ensureWebhook(`${publicBase()}/api/shopify-webhook`);
      await shop.setSetting("wa_messages", on ? "true" : "false");
      return res.status(200).json({ waOn: on });
    }
    if (body.action === "wa_confirm_send") {
      const o = await shop.getOrder(body.id);
      return res.status(200).json(await notify.sendConfirm(o));
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
      if (on) webhook = await shop.ensureWebhook(`${publicBase()}/api/shopify-webhook`);
      await shop.setSetting("auto_book", on ? "true" : "false");
      return res.status(200).json({ auto: on, webhook });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
