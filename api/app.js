// App home ("/"). When opened from Shopify admin, verify Shopify's signed link and go to the orders page.
import { createHmac, timingSafeEqual } from "node:crypto";
import { stores, clientSecretFor } from "../lib/store.js";

function shopifyQueryOk(params, secret) {
  const hmac = params.get("hmac");
  if (!secret || !hmac) return false;
  const msg = [...params.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const digest = createHmac("sha256", secret).update(msg).digest("hex");
  const a = Buffer.from(digest), b = Buffer.from(hmac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const ts = Number(params.get("timestamp") || 0);
  return Math.abs(Date.now() / 1000 - ts) < 24 * 3600;
}

export default function handler(req, res) {
  const params = new URL(req.url, "http://x").searchParams;
  const st = stores().find((x) => x.domain === (params.get("shop") || ""));
  if (st && shopifyQueryOk(params, clientSecretFor(st.key)) && process.env.CONNECTOR_KEY) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Location", `/orders/${encodeURIComponent(process.env.CONNECTOR_KEY)}`);
    return res.status(302).end();
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>TCS Sync</title>
<body style="font:15px system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#f6f5f2;color:#1d1d1b;padding:16px">
<div style="max-width:420px;text-align:center"><h1 style="font-size:20px">TCS Sync · Chitral House</h1>
<p>Open this app from your Shopify admin (Apps → TCS Sync) or use your private orders link.</p></div></body>`);
}
