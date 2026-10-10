// Twice-daily WhatsApp delivery updates (Vercel cron). Auth: CRON_SECRET bearer, or ?key=CONNECTOR_KEY.
import { keyOk } from "../lib/auth.js";
import * as notify from "../lib/notify.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  // Vercel cron sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set; otherwise its user agent.
  // The run is idempotent (tags prevent duplicate messages), so the user-agent fallback is low risk.
  const cronOk = process.env.CRON_SECRET ? bearer === process.env.CRON_SECRET : /vercel-cron/i.test(req.headers["user-agent"] || "");
  if (!cronOk && !keyOk(url.searchParams.get("key"))) return res.status(403).send("Forbidden");
  if (!(await notify.isOn())) return res.status(200).json({ skipped: "WhatsApp messages are off" });
  try {
    const r = await notify.runTracking({ dryRun: url.searchParams.get("dry") === "1" });
    console.log("tracking-run", JSON.stringify({ checked: r.checked, actions: r.results.length }));
    return res.status(200).json(r);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
