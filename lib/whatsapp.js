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

// ---------------- Message templates ----------------
export const TEMPLATES = [
  {
    name: "ch_order_confirm",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "BODY",
        text: "Assalam o Alaikum {{1}}! 🌿\nThank you for your Chitral House order {{2}}.\nItems: {{3}}\nAmount (Cash on Delivery): Rs {{4}}\nAddress: {{5}}\nPlease confirm so we can dispatch your parcel today.",
        example: { body_text: [["Salman", "#51125", "20g Pure Shilajit Resin", "2,550", "House 12, Street 3, Peer Colony, Lahore"]] },
      },
      { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Confirm order" }, { type: "QUICK_REPLY", text: "Cancel order" }] },
    ],
  },
  {
    name: "ch_order_shipped",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "BODY",
        text: "Your Chitral House order {{1}} has been dispatched via TCS 🚚\nTracking number: {{2}}\nAmount to pay at delivery: Rs {{3}}\nThank you for shopping with us.",
        example: { body_text: [["#51125", "173018617641", "2,550"]] },
      },
      { type: "BUTTONS", buttons: [{ type: "URL", text: "Track parcel", url: "https://www.tcsexpress.com/track/{{1}}", example: ["https://www.tcsexpress.com/track/173018617641"] }] },
    ],
  },
  {
    name: "ch_out_for_delivery",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "BODY",
        text: "Good news {{1}}! Your Chitral House parcel is out for delivery today with TCS.\nAmount to pay: Rs {{2}}\nPlease keep your phone on, the rider will call you.",
        example: { body_text: [["Salman", "2,550"]] },
      },
    ],
  },
  {
    name: "ch_delivery_issue",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "BODY",
        text: "Dear {{1}}, TCS could not deliver your Chitral House parcel today ({{2}}).\nWould you like us to try again?",
        example: { body_text: [["Salman", "customer not at home"]] },
      },
      { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Deliver again" }, { type: "QUICK_REPLY", text: "Cancel order" }] },
    ],
  },
];

export async function createTemplates() {
  const out = [];
  for (const t of TEMPLATES) {
    try { const r = await graph("POST", `${WABA_ID()}/message_templates`, t); out.push({ name: t.name, ok: true, id: r.id, status: r.status, category: r.category }); }
    catch (e) { out.push({ name: t.name, ok: false, error: e.message }); }
  }
  return out;
}

export async function listTemplates() {
  const r = await graph("GET", `${WABA_ID()}/message_templates?fields=name,status,category,language,rejected_reason&limit=50`);
  return (r.data || []).map((t) => ({ name: t.name, status: t.status, category: t.category, language: t.language, rejected_reason: t.rejected_reason }));
}
