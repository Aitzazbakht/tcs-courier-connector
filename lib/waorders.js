// WhatsApp Orders (Phase 1): one real orderCreate test through the app's own Shopify login.
import * as shop from "./shopify.js";
import { withStore } from "./store.js";

const MUT = `mutation Create($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
  orderCreate(order: $order, options: $options) {
    order { id name tags note displayFinancialStatus displayFulfillmentStatus sourceIdentifier
      totalPriceSet { shopMoney { amount currencyCode } } totalOutstandingSet { shopMoney { amount } }
      shippingAddress { name address1 city phone countryCodeV2 }
      lineItems(first: 5) { nodes { title quantity variant { id } originalUnitPriceSet { shopMoney { amount } } } } }
    userErrors { field message code }
  }
}`;

export async function phase1Test(store = "house") {
  const order = {
    currency: "PKR",
    financialStatus: "PENDING",
    sourceIdentifier: "wa-phase1-test-abdullah-awan",
    phone: "+923325550066",
    tags: ["WhatsApp", "COD", "Chouse", "Instagram", "Test"],
    note: "WhatsApp order (Platform: Chouse insta). COD amount: Rs 4500.",
    lineItems: [{ variantId: "gid://shopify/ProductVariant/51678886756636", quantity: 1, priceSet: { shopMoney: { amount: "4500.00", currencyCode: "PKR" } } }],
    shippingAddress: { firstName: "Abdullah", lastName: "Awan", address1: "79-E Lahore Press Club Housing Scheme Harbanspura", city: "Lahore", countryCode: "PK", phone: "+923325550066" },
  };
  const options = { inventoryBehaviour: "DECREMENT_IGNORING_POLICY", sendReceipt: false, sendFulfillmentReceipt: false };
  return withStore(store, async () => {
    const d = await shop.gql(MUT, { order, options });
    return d.orderCreate;
  });
}
