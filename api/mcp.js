// MCP server (Streamable HTTP, JSON responses) for TCS Courier.
// Deploy on Vercel; add https://<your-app>.vercel.app/api/mcp?key=<CONNECTOR_KEY>
// as a custom connector in Claude.
import { timingSafeEqual } from "node:crypto";
import { TOOLS } from "../lib/tools.js";

const SERVER_INFO = { name: "tcs-courier", version: "1.0.0" };
const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];

function authorized(req) {
  const expected = process.env.CONNECTOR_KEY;
  if (!expected) return false; // refuse to run unprotected
  const url = new URL(req.url, "http://x");
  const header = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const got = url.searchParams.get("key") || header;
  if (!got || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize": {
      const v = SUPPORTED.includes(params?.protocolVersion) ? params.protocolVersion : SUPPORTED[0];
      return ok(id, {
        protocolVersion: v,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "TCS Courier (Pakistan) data for Chitral House. Use track_shipment for parcel status, delivery_return_stats for delivered vs returned rates, cod_payments / payment_invoice for COD settlement. book_shipment and cancel_shipment must be previewed with confirm=false and only run with confirm=true after the user approves.",
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS.map(({ run, ...t }) => t) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${params?.name}`);
      try {
        const result = await tool.run(params.arguments || {});
        return ok(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        return ok(id, { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] });
      }
    }
    default:
      if (isNotification) return null; // e.g. notifications/initialized
      return fail(id, -32601, `Method not found: ${method}`);
  }
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized: missing or wrong key" });

  if (req.method !== "POST") {
    // No server-initiated stream; stateless server.
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }

  let body;
  try { body = await readBody(req); } catch { return res.status(400).json(fail(null, -32700, "Parse error")); }

  const batch = Array.isArray(body) ? body : [body];
  const out = (await Promise.all(batch.map(handle))).filter(Boolean);
  if (!out.length) return res.status(202).end();
  res.setHeader("Content-Type", "application/json");
  return res.status(200).send(JSON.stringify(Array.isArray(body) ? out : out[0]));
}
