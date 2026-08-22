require("@shopify/shopify-api/adapters/node");

const {
  shopifyApi,
  ApiVersion
} = require("@shopify/shopify-api");

const {
  restResources
} = require("@shopify/shopify-api/rest/admin/2026-07");

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || "",

  apiSecretKey:
    process.env.SHOPIFY_API_SECRET || "",

  scopes: [
    "read_products",
    "write_products",
    "read_customers",
    "read_orders"
  ],

  hostName:
    process.env.SHOPIFY_HOST ||
    "localhost:3000",

  apiVersion: ApiVersion.July26,

  isEmbeddedApp: true,

  restResources
});

module.exports = shopify;
