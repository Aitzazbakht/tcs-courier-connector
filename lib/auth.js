import { timingSafeEqual, createHmac } from "node:crypto";

export function keyOk(got) {
  const expected = process.env.CONNECTOR_KEY || "";
  if (!expected || !got || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export function shopifyHmacOk(rawBody, hmacHeader, secret = process.env.SHOPIFY_CLIENT_SECRET || "") {
  if (!secret || !hmacHeader) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(digest), b = Buffer.from(String(hmacHeader));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function rawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

export const publicBase = () =>
  process.env.PUBLIC_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://tcs-courier-connector.vercel.app");
