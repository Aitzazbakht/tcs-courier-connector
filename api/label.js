// Serves a TCS CN label as a PDF: /label/<CONNECTOR_KEY>/<CN>
import { timingSafeEqual } from "node:crypto";
import { labelPdf } from "../lib/tcs.js";

function keyOk(got) {
  const expected = process.env.CONNECTOR_KEY || "";
  if (!expected || !got || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (!keyOk(url.searchParams.get("key"))) return res.status(403).send("Forbidden");
  const cn = (url.searchParams.get("cn") || "").replace(/\D/g, "");
  if (!cn) return res.status(400).send("Missing CN");
  try {
    const pdf = await labelPdf(cn);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="TCS-label-${cn}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(pdf);
  } catch (e) {
    return res.status(502).send(e.message);
  }
}
