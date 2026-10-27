// Installable-app files for the orders page:
//   /orders/<key>/manifest.webmanifest  (needs the key, because it holds the start address)
//   /orders/<key>/sw.js                  (tiny service worker: lets browsers offer "install", caches nothing)
//   /pwa-icon-<size>.png                 (home-screen icons)
import { keyOk } from "../lib/auth.js";
import { ICONS } from "../lib/pwa-icons.js";

export default function handler(req, res) {
  const u = new URL(req.url, "http://x");
  const f = u.searchParams.get("f");
  if (f === "icon") {
    const s = String(u.searchParams.get("s") || "");
    const b64 = ICONS[s];
    if (!b64) return res.status(404).send("Not found");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=604800");
    return res.status(200).send(Buffer.from(b64, "base64"));
  }
  const key = u.searchParams.get("key");
  if (f === "sw") {
    if (!keyOk(key)) return res.status(403).send("Forbidden");
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Service-Worker-Allowed", "/orders/" + key);
    // No caching on purpose: orders and customer data must always be live.
    return res.status(200).send(
      'self.addEventListener("install", () => self.skipWaiting());\n' +
      'self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));\n' +
      'self.addEventListener("fetch", () => {});\n');
  }
  if (f === "manifest") {
    if (!keyOk(key)) return res.status(403).send("Forbidden");
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    const start = "/orders/" + key;
    return res.status(200).send(JSON.stringify({
      name: "Chitral House Orders", short_name: "Orders", description: "Orders, delivery and marketing for Chitral House and Chitral Herbs",
      start_url: start, scope: start, id: start, display: "standalone", orientation: "any",
      background_color: "#15211D", theme_color: "#15211D",
      icons: [
        { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/pwa-icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    }));
  }
  return res.status(404).send("Not found");
}
