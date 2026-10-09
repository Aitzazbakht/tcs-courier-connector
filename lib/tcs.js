// TCS eCom API client — built from the TCS "COD API User Guide v1.0".
// All credentials come from environment variables (set them in Vercel, never in code).

const BASES = {
  sandbox: "https://devconnect.tcscourier.com",
  production: "https://ociconnect.tcscourier.com",
};

// Non-secret account defaults (env vars override). Secrets stay in Vercel only.
const DEFAULTS = {
  TCS_ACCOUNT_NO: "716820",
  TCS_CUSTOMER_NO: "716820",
  TCS_COST_CENTER: "01",
  SHIPPER_NAME: "Chitral Herbs",
  SHIPPER_ADDRESS: "Flat 406, Block B, Meher Apartments, H-13, Islamabad",
  SHIPPER_CITY_CODE: "ISB",
  SHIPPER_CITY_NAME: "Islamabad",
  SHIPPER_MOBILE: "03186794645",
};
const env = (k, d) => process.env[k] || DEFAULTS[k] || d;
const BASE = () => BASES[env("TCS_ENV", "production")] || BASES.production;

// ---- token cache (lives as long as the serverless instance is warm) ----
const cache = { bearer: null, bearerExp: 0, access: null, accessExp: 0 };
const stillValid = (exp) => exp && Date.now() < exp - 5 * 60 * 1000; // refresh 5 min early

function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    p.append(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function raw(method, path, { params, body, bearer } = {}) {
  const url = BASE() + path + (method === "GET" ? qs(params || {}) : "");
  const headers = { Accept: "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/pdf")) {
    return { status: res.status, pdf: true, size: Number(res.headers.get("content-length") || 0) };
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 2000) }; }
  if (res.status === 401 || res.status === 403) {
    const err = new Error(`TCS rejected the credentials (HTTP ${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
    err.auth = true;
    throw err;
  }
  if (!res.ok) throw new Error(`TCS API error HTTP ${res.status} on ${path}: ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

// Authorization API: clientid + clientsecret -> bearer token (header for every call)
// TCS may instead issue a long-lived bearer token directly (TCS_BEARER_TOKEN) — then no client id/secret is needed.
async function getBearer(force = false) {
  const fixed = env("TCS_BEARER_TOKEN");
  if (fixed) return fixed.replace(/^Bearer\s+/i, "").trim();
  if (!force && cache.bearer && stillValid(cache.bearerExp)) return cache.bearer;
  const clientid = env("TCS_CLIENT_ID");
  const clientsecret = env("TCS_CLIENT_SECRET");
  if (!clientid || !clientsecret) throw new Error("Missing TCS_BEARER_TOKEN (or TCS_CLIENT_ID / TCS_CLIENT_SECRET) environment variables.");
  const d = await raw("GET", "/auth/api/auth", { params: { clientid, clientsecret } });
  const t = d?.result?.accessToken || d?.result?.accesstoken || d?.accessToken;
  if (!t) throw new Error(`Could not get bearer token from TCS: ${JSON.stringify(d).slice(0, 300)}`);
  cache.bearer = t;
  cache.bearerExp = Date.parse(d?.result?.expiry || "") || Date.now() + 60 * 60 * 1000;
  return t;
}

// eCom Authentication API: username + password -> accesstoken (sent inside request bodies/params)
async function getAccessToken(force = false) {
  if (!force && cache.access && stillValid(cache.accessExp)) return cache.access;
  const username = env("TCS_USERNAME");
  const password = env("TCS_PASSWORD");
  if (!username || !password) throw new Error("Missing TCS_USERNAME / TCS_PASSWORD environment variables.");
  const bearer = await getBearer();
  const d = await raw("GET", "/ecom/api/authentication/token", { params: { username, password }, bearer });
  const t = d?.accesstoken || d?.accessToken || d?.result?.accesstoken;
  if (!t) throw new Error(`Could not get eCom access token from TCS: ${JSON.stringify(d).slice(0, 300)}`);
  cache.access = t;
  cache.accessExp = Date.parse(d?.expiry || "") || Date.now() + 60 * 60 * 1000;
  return t;
}

// Authenticated call; retries once with fresh tokens if TCS says the token expired.
async function call(method, path, { params = {}, body, withAccessToken = true } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const force = attempt === 1;
    const bearer = await getBearer(force);
    let p = params, b = body;
    if (withAccessToken) {
      const accesstoken = await getAccessToken(force);
      if (method === "GET") p = { ...params, accesstoken };
      else b = { ...body, accesstoken };
    }
    try {
      return await raw(method, path, { params: p, body: b, bearer });
    } catch (e) {
      if (e.auth && attempt === 0) continue;
      throw e;
    }
  }
}

const account = () => env("TCS_CUSTOMER_NO") || env("TCS_ACCOUNT_NO");

// ---------------- API wrappers ----------------

export async function diagnose() {
  const out = { environment: env("TCS_ENV", "production"), base_url: BASE() };
  out.bearer = env("TCS_BEARER_TOKEN") ? "using TCS_BEARER_TOKEN" : "using client id/secret";
  try { await getBearer(true); out.bearer_ok = true; } catch (e) { out.bearer_ok = false; out.bearer_error = e.message; return out; }
  try { await getAccessToken(true); out.login_ok = true; } catch (e) { out.login_ok = false; out.login_error = e.message; }
  const missing = ["TCS_ACCOUNT_NO", "TCS_COST_CENTER", "SHIPPER_ADDRESS", "SHIPPER_MOBILE"].filter((k) => !env(k));
  out.missing_settings_for_booking = missing;
  if (out.login_ok && account()) {
    try { out.cost_centers = (await costCenters())?.detail; } catch (e) { out.cost_center_error = e.message; }
  }
  return out;
}

export async function track(cns) {
  return call("GET", "/tracking/api/Tracking/GetDynamicTrackDetail", {
    params: { consignee: cns }, withAccessToken: false,
  });
}

export async function paymentDetail(fromdate, todate) {
  return call("GET", "/ecom/api/Payment/detail", { params: { customerno: account(), fromdate, todate } });
}

export async function paymentStatus(consignmentno) {
  return call("GET", "/ecom/api/Payment/status", { params: { customerno: account(), consignmentno } });
}

export async function paymentInvoice(invoiceno) {
  return call("GET", "/ecom/api/booking/paymentinvoice", { params: { invoiceno } });
}

export async function cancelBooking(consignmentNumber) {
  return call("POST", "/ecom/api/booking/cancel", { body: { consignmentNumber: String(consignmentNumber) } });
}

export async function cityList(countrycode = "PK") {
  return call("GET", "/ecom/api/setup/citylistbycountry", { params: { countrycode } });
}

export async function areaCodes(citycode, area) {
  return call("GET", "/ecom/api/setup/areacode", { params: { citycode, area } });
}

export async function costCenters() {
  return call("GET", "/ecom/inquiry/costcenterinquiry", { params: { customerno: account() } });
}

// Raw label PDF (Buffer) — TCS returns application/pdf for this endpoint.
export async function labelPdf(consignmentno) {
  const bearer = await getBearer();
  const accesstoken = await getAccessToken();
  const url = BASE() + "/ecom/api/print/label" + qs({ consignmentno, shipperdetail: "true", accesstoken });
  const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}`, Accept: "application/pdf, application/json" } });
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !ct.includes("pdf")) throw new Error(`TCS label error HTTP ${res.status}: ${buf.toString("utf8").slice(0, 300)}`);
  return buf;
}

export async function labelUrl(consignmentno) {
  return call("GET", "/ecom/api/print/label", { params: { consignmentno, shipperdetail: "true" } });
}

export async function createBooking(o) {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const body = {
    consignmentno: "",
    shipperinfo: {
      tcsaccount: env("TCS_ACCOUNT_NO"),
      shippername: env("SHIPPER_NAME"),
      address1: env("SHIPPER_ADDRESS"),
      countrycode: "PK",
      countryname: "Pakistan",
      citycode: env("SHIPPER_CITY_CODE"),
      cityname: env("SHIPPER_CITY_NAME"),
      mobile: env("SHIPPER_MOBILE"),
    },
    consigneeinfo: {
      firstname: o.first_name,
      middlename: o.middle_name || o.last_name || o.first_name,
      lastname: o.last_name || "",
      address1: o.address,
      address2: o.address2 || "",
      countrycode: "PK",
      countryname: "Pakistan",
      citycode: o.city_code || "",
      cityname: o.city_name,
      email: o.email || "",
      areacode: o.area_code || "",
      areaname: o.area_name || "",
      landmark: o.landmark || "",
      mobile: o.mobile,
    },
    vendorinfo: {},
    shipmentinfo: {
      costcentercode: o.cost_center_code || env("TCS_COST_CENTER"),
      referenceno: o.order_ref || "",
      contentdesc: o.contents || env("DEFAULT_CONTENTS", "Shilajit"),
      servicecode: o.service_code || env("DEFAULT_SERVICE_CODE", "O"),
      shipmentdate: `${dd}/${mm}/${today.getFullYear()}`,
      currency: "PKR",
      codamount: Math.round(o.cod_amount),
      weightinkg: Math.max(0.5, o.weight_kg ?? 0.5),
      pieces: o.pieces ?? 1,
      fragile: !!o.fragile,
      remarks: o.remarks || "",
      skus: [
        {
          description: o.contents || env("DEFAULT_CONTENTS", "Shilajit"),
          quantity: o.pieces ?? 1,
          weight: Math.max(0.5, o.weight_kg ?? 0.5),
          uom: "KG",
          unitprice: Math.max(1, Math.round(o.cod_amount / (o.pieces ?? 1))),
        },
      ],
    },
  };
  return call("POST", "/ecom/api/booking/create", { body });
}

// Status codes TCS uses in payment/detail ("cn status")
export const CN_STATUS = {
  OK: "Delivered",
  RO: "Returned to origin",
  RT: "Return in transit",
  RS: "Returned to sender",
  CN: "Cancelled",
  SC: "Awaiting receiver collection",
};
