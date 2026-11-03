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
    console.error("stock-auto failed", e && e.stack || e);
    try { // leave a visible trace in the Stock tab history
      const { loadState, saveState } = await import("../lib/stock.js");
      const st = await loadState();
      st.autoLog = (st.autoLog || []).concat([{ at: new Date().toISOString(), part: "failed", deducted: 0, returned: 0, unmapped: 0, notFound: 0, unmappedList: [], notFoundList: [], warnings: ["Run failed: " + e.message] }]).slice(-20);
      await saveState(st);
    } catch {}
    return res.status(500).json({ error: e.message });
  }
}
