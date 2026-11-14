// Nightly save of orders and final TCS answers into Upstash (Vercel cron, 02:10 Pakistan time), so the reports load quickly.
// Auth: CRON_SECRET bearer / Vercel cron user agent, or ?key=CONNECTOR_KEY. Safe to run any time.
import { keyOk } from "../lib/auth.js";
import { nightlyWarm } from "../lib/daily.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const cronOk = process.env.CRON_SECRET ? bearer === process.env.CRON_SECRET : /vercel-cron/i.test(req.headers["user-agent"] || "");
  if (!cronOk && !keyOk(url.searchParams.get("key"))) return res.status(403).send("Forbidden");
  try {
    const r = await nightlyWarm();
    console.log("nightly-warm", JSON.stringify(r));
    return res.status(200).json(r);
  } catch (e) {
    console.error("nightly-warm failed", e && e.stack || e);
    return res.status(500).json({ error: e.message });
  }
}
