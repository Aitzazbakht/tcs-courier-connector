// Nightly stock update (Vercel cron, 23:50 Pakistan time): deduct parcels booked on TCS, add back returns.
// Auth: CRON_SECRET bearer / Vercel cron user agent, or ?key=CONNECTOR_KEY. Safe to run twice: every parcel is logged once.
import { keyOk } from "../lib/auth.js";
import { runAuto } from "../lib/stockauto.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const cronOk = process.env.CRON_SECRET ? bearer === process.env.CRON_SECRET : /vercel-cron/i.test(req.headers["user-agent"] || "");
  if (!cronOk && !keyOk(url.searchParams.get("key"))) return res.status(403).send("Forbidden");
  try {
    const r = await runAuto();
    console.log("stock-auto", JSON.stringify({ deducted: r.deducted.length, returned: r.returned.length, unmapped: r.unmapped.length, warnings: r.warnings }));
    return res.status(200).json(r);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
