import * as tcs from "./tcs.js";

const str = (description) => ({ type: "string", description });
const date = (description) => ({ type: "string", description: `${description} (YYYY-MM-DD)`, pattern: "^\\d{4}-\\d{2}-\\d{2}$" });

const pick = (row, ...keys) => {
  for (const k of keys) if (row?.[k] !== undefined && row[k] !== null) return row[k];
  return undefined;
};
const num = (v) => (typeof v === "number" ? v : Number(v) || 0);

function normalizeRow(r) {
  const code = String(pick(r, "cn status", "cn_status", "cnstatus") || "").toUpperCase();
  return {
    cn: pick(r, "cn by courier", "cn_by_courier", "cnsg_no"),
    order: pick(r, "order no", "order_no", "cust_ref"),
    booked: pick(r, "booking date", "booking_date", "bkg_dat"),
    delivered: pick(r, "delivery date", "delivery_date"),
    city: pick(r, "city", "dstn"),
    status_code: code,
    status: tcs.CN_STATUS[code] || code || "In transit / not yet updated",
    paid: String(pick(r, "payment status", "payment_status") || "").toUpperCase() === "Y",
    amount_paid: num(pick(r, "amount paid", "amount_paid")),
    delivery_charges: num(pick(r, "delivery charges", "delivery_charges", "courier_charges")),
    payment_date: pick(r, "payment date", "payment_date"),
    weight: num(pick(r, "parcel weight", "parcel_weight", "wtt_bkg")),
  };
}

async function rowsForRange(from, to) {
  const d = await tcs.paymentDetail(from, to);
  const list = d?.detail || d?.data || [];
  return list.map(normalizeRow);
}

export const TOOLS = [
  {
    name: "test_connection",
    description: "Check the TCS connection: whether the bearer token and API login work, which settings are missing, and list cost centers. Use this first if anything fails.",
    annotations: { readOnlyHint: true },
    inputSchema: { type: "object", properties: {} },
    run: async () => tcs.diagnose(),
  },
  {
    name: "track_shipment",
    description: "Track one or more TCS shipments by consignment (CN) number. Returns current status, origin/destination and the full checkpoint history.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: { consignment_numbers: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20, description: "TCS CN numbers, e.g. 779412326902" } },
      required: ["consignment_numbers"],
    },
    run: async ({ consignment_numbers }) => {
      const results = [];
      for (const cn of consignment_numbers) {
        try {
          const d = await tcs.track([cn]);
          if (!d?.shipmentinfo) results.push({ cn, error: d?.shipmentsummary || "No data found / invalid CN" });
          else results.push({
            cn,
            summary: d.shipmentsummary,
            shipment: d.shipmentinfo?.[0],
            latest: d.deliveryinfo?.[0],
            checkpoints: d.checkpoints,
          });
        } catch (e) { results.push({ cn, error: e.message }); }
      }
      return results;
    },
  },
  {
    name: "delivery_return_stats",
    description: "Delivered vs returned performance for shipments booked in a date range: counts, delivery rate, return rate, pending, courier charges and COD paid out, plus a per-city breakdown sorted by return rate. Keep ranges to about 31 days or less.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: { from_date: date("Start date"), to_date: date("End date"), top_cities: { type: "number", description: "How many cities to include in the breakdown (default 15)" } },
      required: ["from_date", "to_date"],
    },
    run: async ({ from_date, to_date, top_cities = 15 }) => {
      const rows = await rowsForRange(from_date, to_date);
      const total = rows.length;
      const by = (code) => rows.filter((r) => r.status_code === code).length;
      const delivered = by("OK");
      const returned = rows.filter((r) => ["RO", "RT", "RS"].includes(r.status_code)).length;
      const closed = delivered + returned;
      const statusCounts = {};
      for (const r of rows) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      const cities = {};
      for (const r of rows) {
        const c = (cities[r.city || "?"] ||= { city: r.city || "?", shipments: 0, delivered: 0, returned: 0 });
        c.shipments++;
        if (r.status_code === "OK") c.delivered++;
        if (["RO", "RT", "RS"].includes(r.status_code)) c.returned++;
      }
      const cityList = Object.values(cities)
        .map((c) => ({ ...c, return_rate_pct: c.delivered + c.returned ? +((100 * c.returned) / (c.delivered + c.returned)).toFixed(1) : null }))
        .sort((a, b) => b.shipments - a.shipments)
        .slice(0, top_cities)
        .sort((a, b) => (b.return_rate_pct ?? -1) - (a.return_rate_pct ?? -1));
      return {
        range: { from_date, to_date },
        total_shipments: total,
        delivered,
        returned,
        in_progress_or_other: total - closed,
        delivery_rate_pct_of_closed: closed ? +((100 * delivered) / closed).toFixed(1) : null,
        return_rate_pct_of_closed: closed ? +((100 * returned) / closed).toFixed(1) : null,
        status_counts: statusCounts,
        courier_charges_total: rows.reduce((s, r) => s + r.delivery_charges, 0),
        cod_paid_out_total: rows.reduce((s, r) => s + r.amount_paid, 0),
        unpaid_delivered_count: rows.filter((r) => r.status_code === "OK" && !r.paid).length,
        cities: cityList,
        note: "Rates are of closed shipments (delivered + returned); in-transit parcels are excluded.",
      };
    },
  },
  {
    name: "cod_payments",
    description: "List COD payment records for shipments booked in a date range: CN, order ref, status, whether TCS has paid, amount paid, charges and payment date. Use only_unpaid to find delivered parcels TCS hasn't settled yet.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        from_date: date("Start date"),
        to_date: date("End date"),
        only_unpaid: { type: "boolean", description: "Only delivered shipments not yet paid out" },
        limit: { type: "number", description: "Max rows to return (default 200)" },
      },
      required: ["from_date", "to_date"],
    },
    run: async ({ from_date, to_date, only_unpaid = false, limit = 200 }) => {
      let rows = await rowsForRange(from_date, to_date);
      if (only_unpaid) rows = rows.filter((r) => r.status_code === "OK" && !r.paid);
      return {
        count: rows.length,
        total_paid: rows.reduce((s, r) => s + r.amount_paid, 0),
        total_charges: rows.reduce((s, r) => s + r.delivery_charges, 0),
        rows: rows.slice(0, limit),
        truncated: rows.length > limit,
      };
    },
  },
  {
    name: "cod_payment_status",
    description: "COD payment status for a single consignment: delivered/returned, paid or not, amount and payment date.",
    annotations: { readOnlyHint: true },
    inputSchema: { type: "object", properties: { consignment_number: str("TCS CN number") }, required: ["consignment_number"] },
    run: async ({ consignment_number }) => {
      const d = await tcs.paymentStatus(consignment_number);
      const list = d?.detail;
      if (!list?.length) return { consignment_number, error: d?.message || "Not found" };
      return list.map(normalizeRow);
    },
  },
  {
    name: "payment_invoice",
    description: "Fetch a TCS payment invoice by invoice number, listing every consignment settled in it with COD amount, courier charges and GST, plus totals.",
    annotations: { readOnlyHint: true },
    inputSchema: { type: "object", properties: { invoice_no: str("TCS invoice number") }, required: ["invoice_no"] },
    run: async ({ invoice_no }) => {
      const d = await tcs.paymentInvoice(invoice_no);
      const rows = d?.data || [];
      return {
        invoice_no,
        shipments: rows.length,
        cod_total: rows.reduce((s, r) => s + num(r.codamount), 0),
        courier_charges_total: rows.reduce((s, r) => s + num(r.courier_charges), 0),
        gst_total: +rows.reduce((s, r) => s + num(r.gst), 0).toFixed(2),
        rows,
      };
    },
  },
  {
    name: "lookup_city",
    description: "Find TCS city codes by name (needed for booking). Returns matching city code/name pairs.",
    annotations: { readOnlyHint: true },
    inputSchema: { type: "object", properties: { query: str("City name or part of it, e.g. 'peshawar'") }, required: ["query"] },
    run: async ({ query }) => {
      const d = await tcs.cityList("PK");
      const q = query.toLowerCase();
      return (d?.data || []).filter((c) => `${c.cityname} ${c.citycode}`.toLowerCase().includes(q)).slice(0, 25);
    },
  },
  {
    name: "list_cost_centers",
    description: "List the cost centers (pickup locations) on the TCS account, with their codes and pickup/return addresses.",
    annotations: { readOnlyHint: true },
    inputSchema: { type: "object", properties: {} },
    run: async () => (await tcs.costCenters())?.detail || [],
  },
  {
    name: "get_label",
    description: "Get the printable CN label (airway bill) for a consignment.",
    annotations: { readOnlyHint: true },
    inputSchema: { type: "object", properties: { consignment_number: str("TCS CN number") }, required: ["consignment_number"] },
    run: async ({ consignment_number }) => {
      const base = process.env.PUBLIC_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
      const cn = String(consignment_number).replace(/\D/g, "");
      return {
        consignment_number: cn,
        label_pdf_url: `${base}/label/${process.env.CONNECTOR_KEY}/${cn}`,
        note: "Open this link to download/print the label PDF. It contains the private connector key — don't share it publicly.",
      };
    },
  },
  {
    name: "book_shipment",
    description: "Book a new COD shipment with TCS from the Chitral House account. ALWAYS call first with confirm=false to show the user a preview, and only call with confirm=true after the user explicitly approves. Use lookup_city to get city_code if unsure.",
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        first_name: str("Customer first name (min 3 chars)"),
        last_name: str("Customer last name"),
        mobile: { type: "string", pattern: "^03\\d{9}$", description: "Customer mobile, 11 digits like 03001234567" },
        address: str("Full delivery address"),
        city_name: str("Destination city name"),
        city_code: str("TCS city code, e.g. LHE, KHI, ISB"),
        cod_amount: { type: "number", description: "Cash to collect in PKR (0 for prepaid)" },
        order_ref: str("Shopify/website order number"),
        weight_kg: { type: "number", description: "Weight in kg (min 0.5, default 0.5)" },
        pieces: { type: "number", description: "Number of pieces (default 1)" },
        contents: str("Product details for the packer, e.g. '10g Pure Shilajit Resin*2 + Shilajit Gummies 40 Count' (default 'Shilajit')"),
        landmark: str("Nearby landmark"),
        email: str("Customer email"),
        remarks: str("Remarks for TCS rider (default 'Kindly call consignee before delivery')"),
        fragile: { type: "boolean", description: "Default true" },
        cost_center_code: str("Override the default cost center"),
        confirm: { type: "boolean", description: "false = preview only, true = actually book" },
      },
      required: ["first_name", "mobile", "address", "city_name", "cod_amount", "confirm"],
    },
    run: async (args) => {
      if (args.address.length < 3) throw new Error("address is too short.");
      if (args.cod_amount < 0 || args.cod_amount > 250000) throw new Error("cod_amount must be between 0 and 250,000 PKR.");
      if (!args.confirm) {
        return {
          preview: true,
          message: "Nothing booked yet. Show this to the user and call again with confirm=true once they approve.",
          shipment: {
            ...args, confirm: undefined,
            weight_kg: Math.max(0.5, args.weight_kg ?? 0.5), pieces: args.pieces ?? 1,
            service: "Express (Overnight)", fragile: args.fragile ?? true,
            remarks: args.remarks || "Kindly call consignee before delivery",
          },
        };
      }
      const d = await tcs.createBooking(args);
      if (d?.consignmentNo) return { booked: true, consignment_number: d.consignmentNo, message: d.message };
      return { booked: false, response: d };
    },
  },
  {
    name: "cancel_shipment",
    description: "Cancel a booked TCS shipment (only works before pickup). Call with confirm=false first to restate what will be cancelled, then confirm=true after the user approves.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object",
      properties: { consignment_number: str("TCS CN number"), confirm: { type: "boolean" } },
      required: ["consignment_number", "confirm"],
    },
    run: async ({ consignment_number, confirm }) => {
      if (!confirm) return { preview: true, message: `Will cancel CN ${consignment_number}. Call again with confirm=true after the user approves.` };
      return tcs.cancelBooking(consignment_number);
    },
  },
];
