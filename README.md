# TCS Courier connector for Claude

Lets Claude pull data from your TCS account: track parcels, delivered vs returned rates, COD payments and invoices, and book or cancel shipments (with a confirm step).

No dependencies. Runs as one serverless function on Vercel.

## Tools

| Tool | What it does |
|---|---|
| `test_connection` | Checks the token and login, lists missing settings and your cost centers |
| `track_shipment` | Status and checkpoint history for up to 20 CNs |
| `delivery_return_stats` | Delivered / returned counts and rates for a date range, with per-city return rates |
| `cod_payments` | COD records for a date range; `only_unpaid` finds delivered parcels TCS hasn't paid |
| `booking_report` | COD amount per parcel for a date range (by booking or delivery date), with delivered / returned / in-transit totals |
| `cod_payment_status` | Payment status of one CN |
| `payment_invoice` | All CNs in a TCS invoice with COD, charges and GST totals |
| `lookup_city` | TCS city codes for booking |
| `list_cost_centers` | Pickup locations on your account |
| `get_label` | Printable CN label |
| `book_shipment` | Book a COD shipment (preview first, then confirm) |
| `cancel_shipment` | Cancel before pickup (preview first, then confirm) |

## Orders page: Delivery report tab

The orders page (`/orders/<CONNECTOR_KEY>`) has a **TCS delivery report** tab next to **Blocked**. Pick a From/To date (or Last 30 days / 3 months / 6 months) and it pulls the parcels booked in that range from TCS and shows, overall and city by city: booked, delivered, returned and still in process. Delivered % is delivered ÷ (delivered + returned). Ranges up to about 6 months are fetched in monthly windows because TCS handles roughly 31 days per request.

### Total delivery report tab

Pick one order date (Pakistan time, default yesterday) to see the delivery ratio of every order placed that day across both stores: parcels booked on TCS (latest tracking checkpoint, cached 15 minutes; **Refresh TCS status** bypasses the cache) plus orders delivered by our own rider in Rawalpindi/Islamabad, matched by exact amount and similar name against the courier Google Sheet (`COURIER_SHEET_ID` / `COURIER_SHEET_GID` override the defaults; the sheet must be shared as "anyone with the link can view"). **Download PDF** opens a 2-page A4 print view; choose Save as PDF.

### Delivery problems tab

Lists every parcel still in process with TCS (booked in the last 60 days, from both stores), with its latest TCS status and events. Filter by status with the dropdown and by order date (default: All dates). Results are cached 15 minutes; **Refresh TCS status** checks again. **Mark done** hides the alert for that order.

### Abandoned carts tab

Replaces the old "Booked, last 2 days" tab. Lists checkouts from both stores that were started but never completed, only where the customer left a name and a phone number or email. Pick a From/To date (default last 7 days). **Mark done** is remembered in a shop metafield (`tcs_sync.abandoned_handled`) and the row becomes Handled; tick "Show handled" to see them again.

## Deploy (about 10 minutes)

1. Put this folder in a new **private** GitHub repo.
2. In Vercel: **Add New → Project**, import the repo, keep the default settings, click **Deploy**.
3. In the project: **Settings → Environment Variables**. Add every variable from `.env.example` with your real values. For `CONNECTOR_KEY` use a long random string — it's the password for the connector.
4. **Deployments → ⋯ → Redeploy** so the variables take effect.
5. Your connector URL is:
   `https://<your-project>.vercel.app/mcp/<CONNECTOR_KEY>`

## Add to Claude

**Settings → Connectors → Add custom connector**. Name it `TCS Courier`, paste the URL above, save. Then enable it in a chat from the connectors menu.

Try: *"Track CN 779412326902"*, *"Delivered vs returned for September"*, *"Which delivered parcels from last week haven't been paid yet?"*

## First test

In a Claude chat with the connector enabled, say: *"Run test_connection on TCS."* It shows whether the token and login work and lists your cost centers (use one of those codes for `TCS_COST_CENTER`).

If TCS only gave you sandbox credentials, set `TCS_ENV=sandbox`.

## Security

- Never commit `.env` or put credentials in the code — only in Vercel's environment variables.
- Anyone with the full URL (including `?key=`) can use the connector. Treat it like a password; to revoke, change `CONNECTOR_KEY` and redeploy.

## If something doesn't work

The TCS guide is unclear in places (for example, whether GET calls take parameters in the query string or a body). This connector sends GET parameters as a query string. If a call returns an error after you add real credentials, open Vercel → **Logs**, copy the error, and send it over — the fix is usually a one-line change in `lib/tcs.js`.
