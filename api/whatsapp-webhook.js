// WhatsApp Cloud API webhook: GET = Meta verification, POST = incoming messages / statuses.
import { createHmac, timingSafeEqual } from "node:crypto";
import { rawBody } from "../lib/auth.js";
import { handleButton } from "../lib/notify.js";

export const config = { api: { bodyParser: false } };
const VERIFY = () => process.env.WHATSAPP_VERIFY_TOKEN || "chitralhouse-wa-7Hq2Lp9Xz4Rk";

function sigOk(raw, header) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // until the app secret is added in Vercel
  if (!header) return false;
  const digest = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(digest), b = Buffer.from(String(header));
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET") {
    if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === VERIFY())
      return res.status(200).send(url.searchParams.get("hub.challenge") || "");
    return res.status(403).send("Forbidden");
  }
  if (req.method !== "POST") return res.status(405).end();
  const raw = await rawBody(req);
  if (!sigOk(raw, req.headers["x-hub-signature-256"])) return res.status(401).send("Bad signature");
  try {
    const body = JSON.parse(raw.toString("utf8") || "{}");
    for (const entry of body.entry || [])
      for (const ch of entry.changes || []) {
        const v = ch.value || {};
        for (const m of v.messages || []) {
          const payload = m.button?.payload || m.interactive?.button_reply?.id;
          console.log("wa-message", JSON.stringify({ from: m.from, type: m.type, text: m.text?.body, button: payload }));
          if (payload) {
            try { console.log("wa-button", payload, JSON.stringify(await handleButton(payload))); }
            catch (e) { console.error("wa-button failed", payload, e.message); }
          }
        }
        for (const s of v.statuses || []) console.log("wa-status", s.id, s.status, s.recipient_id);
      }
  } catch (e) { console.error("wa-webhook parse", e.message); }
  return res.status(200).send("OK");
}
