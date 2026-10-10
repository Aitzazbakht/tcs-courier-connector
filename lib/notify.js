// Customer WhatsApp notifications for Shopify orders.
import * as wa from "./whatsapp.js";
import * as shop from "./shopify.js";
import { normalizePhone, productSummary, isPrepaid } from "./sync.js";
import * as tcs from "./tcs.js";

export const TAG = {
  CONFIRM_SENT: "wa-confirm-sent",
  CONFIRMED: "wa-confirmed",
  CANCELLED: "wa-cancelled",
  RETRY: "wa-retry-requested",
  SHIPPED_SENT: "wa-shipped-sent",
  DONE: "wa-tracking-done",
};

const numId = (gid) => String(gid).split("/").pop();
const gidOf = (n) => `gid://shopify/Order/${n}`;
const rs = (n) => Number(n || 0).toLocaleString("en-PK");
const firstName = (o) => {
  const n = (o.shippingAddress?.firstName || o.shippingAddress?.name || "").trim().split(/\s+/)[0] || "";
  return n.length >= 2 ? n[0].toUpperCase() + n.slice(1) : "Customer";
};
const clip = (s, n) => (String(s || "").replace(/\s+/g, " ").trim().slice(0, n) || "-");
export const waNumber = (o) => {
  const p = normalizePhone(o.shippingAddress?.phone) || normalizePhone(o.phone);
  return p ? "92" + p.slice(1) : null;
};
const codOf = (o) => (isPrepaid(o) ? 0 : Math.round(Number(o.totalOutstandingSet?.shopMoney?.amount ?? o.totalPriceSet?.shopMoney?.amount ?? 0)));
const codText = (o) => (codOf(o) === 0 ? "0 (already paid)" : rs(codOf(o)));

export async function isOn() {
  try { return (await shop.getSetting("wa_messages")).value === "true"; } catch { return false; }
}

async function sendTemplate(to, name, bodyParams, extra = []) {
  const components = [{ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: String(t) })) }, ...extra];
  return wa.graph("POST", `${wa.PHONE_ID()}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name, language: { code: "en" }, components },
  });
}

const quickReplies = (payloads) =>
  payloads.map((p, i) => ({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload: p }] }));

export async function sendConfirm(order) {
  const tags = order.tags || [];
  if (tags.includes(TAG.CONFIRM_SENT) || tags.includes(TAG.CONFIRMED)) return { skipped: "already sent" };
  if (tags.some((t) => /^whatsapp$/i.test(t))) return { skipped: "WhatsApp order (already confirmed in chat)" };
  const to = waNumber(order);
  if (!to) return { skipped: "no valid mobile number" };
  const a = order.shippingAddress || {};
  const address = clip([a.address1, a.address2, a.city].filter(Boolean).join(", "), 120);
  const id = numId(order.id);
  const r = await sendTemplate(to, "ch_order_confirm", [firstName(order), order.name, clip(productSummary(order), 200), codText(order), address],
    quickReplies([`confirm|${id}`, `cancel|${id}`]));
  await shop.addTags(order.id, [TAG.CONFIRM_SENT]);
  return { sent: true, id: r.messages?.[0]?.id };
}

export async function sendShipped(order, cn) {
  if ((order.tags || []).includes(TAG.SHIPPED_SENT)) return { skipped: "already sent" };
  const to = waNumber(order);
  if (!to) return { skipped: "no valid mobile number" };
  await sendTemplate(to, "ch_order_shipped", [order.name, cn, codText(order)],
    [{ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: String(cn) }] }]);
  await shop.addTags(order.id, [TAG.SHIPPED_SENT]);
  return { sent: true };
}

// Called by the WhatsApp webhook when a customer taps a quick-reply button.
export async function handleButton(payload) {
  const [action, n] = String(payload || "").split("|");
  if (!n || !/^\d+$/.test(n)) return { ignored: true };
  const id = gidOf(n);
  if (action === "confirm") {
    await shop.addTags(id, [TAG.CONFIRMED]);
    await shop.removeTags(id, [TAG.CANCELLED]).catch(() => {});
    // If auto-booking is on, book it now that the customer confirmed.
    const sync = await import("./sync.js");
    if (await sync.isAutoOn()) return { confirmed: true, booking: await sync.pushOrder(id) };
    return { confirmed: true };
  }
  if (action === "cancel") { await shop.addTags(id, [TAG.CANCELLED]); return { cancelled: true }; }
  if (action === "retry") { await shop.addTags(id, [TAG.RETRY]); return { retry: true }; }
  return { ignored: true };
}

// ---------------- Delivery tracking (run by cron) ----------------
const ISSUE_PATTERNS = [
  [/refused/i, "you were not available to receive it"],
  [/not home|not available/i, "nobody was available at the address"],
  [/address information|incomplete address|address/i, "the rider could not find the address"],
  [/no such receiver|consignee moved/i, "the rider could not find the receiver"],
];
const pkDate = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
const isToday = (s) => {
  const d = new Date(String(s).replace(/^\w+day\s+/i, "").replace(/(\d{1,2}),/, "$1"));
  if (isNaN(d)) return false;
  return d.toISOString().slice(0, 10).replace(/-/g, "") === pkDate();
};

export async function runTracking({ dryRun = false } = {}) {
  const since = new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10);
  const orders = await shop.listOrders(`tag:tcs-booked -tag:${TAG.DONE} created_at:>=${since}`, 400);
  const today = pkDate();
  const results = [];
  const queue = [...orders];
  async function worker() {
    while (queue.length) {
      const o = queue.shift();
      const cn = (o.tags || []).map((t) => /^TCS-(\d{6,})$/i.exec(t)?.[1]).find(Boolean);
      if (!cn) continue;
      try {
        const d = await tcs.track([cn]);
        const code = String(d?.deliveryinfo?.[0]?.code || "").toUpperCase();
        const last = d?.checkpoints?.[0] || {};
        const lastStatus = String(last.status || "");
        if (["OK", "RS", "RO", "RT"].includes(code) || /delivered|returned/i.test(d?.deliveryinfo?.[0]?.status || "")) {
          if (!dryRun) await shop.addTags(o.id, [TAG.DONE]);
          results.push({ order: o.name, cn, action: "closed", code });
          continue;
        }
        const to = waNumber(o);
        if (!to) { results.push({ order: o.name, cn, action: "no phone" }); continue; }
        if (/out for delivery/i.test(lastStatus) && isToday(last.datetime)) {
          const tag = `wa-ofd-${today}`;
          if ((o.tags || []).includes(tag)) continue;
          if (!dryRun) { await sendTemplate(to, "ch_out_for_delivery", [firstName(o), codText(o)]); await shop.addTags(o.id, [tag]); }
          results.push({ order: o.name, cn, action: "out_for_delivery" });
          continue;
        }
        const issue = ISSUE_PATTERNS.find(([re]) => re.test(lastStatus));
        if (issue && isToday(last.datetime)) {
          const tag = `wa-issue-${today}`;
          if ((o.tags || []).includes(tag)) continue;
          const id = numId(o.id);
          if (!dryRun) {
            await sendTemplate(to, "ch_delivery_issue", [firstName(o), issue[1]], quickReplies([`retry|${id}`, `cancel|${id}`]));
            await shop.addTags(o.id, [tag]);
          }
          results.push({ order: o.name, cn, action: "delivery_issue", status: lastStatus });
        }
      } catch (e) {
        results.push({ order: o.name, cn, error: e.message });
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  return { checked: orders.length, today, results };
}
