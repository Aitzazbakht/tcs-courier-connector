// WhatsApp Cloud API helpers.
const GRAPH = "https://graph.facebook.com/v26.0";
export const PHONE_ID = () => process.env.WHATSAPP_PHONE_ID || "1369042556296520";
export const WABA_ID = () => process.env.WHATSAPP_WABA_ID || "1814860402849807";

export async function graph(method, path, body) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("WHATSAPP_TOKEN is not set in Vercel yet.");
  const r = await fetch(`${GRAPH}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    const e = d.error || {};
    throw new Error([e.message, e.error_user_title, e.error_user_msg, e.error_data?.details, e.code && `code ${e.code}`].filter(Boolean).join(" — ") || `HTTP ${r.status}`);
  }
  return d;
}

export const phoneStatus = () =>
  graph("GET", `${PHONE_ID()}?fields=display_phone_number,verified_name,code_verification_status,name_status,status,quality_rating,platform_type,throughput`);

export const register = (pin) => graph("POST", `${PHONE_ID()}/register`, { messaging_product: "whatsapp", pin: String(pin) });

export const subscribeApp = () => graph("POST", `${WABA_ID()}/subscribed_apps`);
