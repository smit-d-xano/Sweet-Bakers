import { table, f, seedFile } from "@xano/sdk";
import { seed } from "./seed/data.js";

export const users = table({
  name: "users",
  auth: true,
  schema: {
    name: f.text({ required: true, methods: ["trim"] }),
    email: f.email({ required: true, methods: ["trim", "lower"] }),
    password: f.password({ required: true }),
    phone: f.text({ default: "" }),
    role: f.enum(["customer", "admin"], { default: "customer" }),
  },
  index: [{ type: "unique", fields: [{ name: "email" }] }],
  seed: seed.users as never,
  publicSeed: ["password"],
});

export const addresses = table({
  name: "addresses",
  schema: {
    user_id: f.tableRef(users, { required: true }),
    line1: f.text({ required: true }),
    line2: f.text({ default: "" }),
    city: f.text({ required: true }),
    state: f.text({ required: true }),
    postal_code: f.text({ required: true }),
    is_default: f.bool({ default: false }),
  },
  index: [{ type: "btree", fields: [{ name: "user_id" }] }],
  seed: seed.addresses as never,
});

export const categories = table({
  name: "categories",
  schema: {
    name: f.text({ required: true }),
    slug: f.text({ required: true }),
    description: f.text({ default: "" }),
  },
  index: [{ type: "unique", fields: [{ name: "slug" }] }],
  seed: seed.categories as never,
});

export const products = table({
  name: "products",
  schema: {
    category_id: f.tableRef(categories, { required: true }),
    name: f.text({ required: true }),
    slug: f.text({ required: true }),
    description: f.text({ default: "" }),
    price: f.decimal({ required: true }),
    images: f.text({ array: true }),
    stock_qty: f.int({ default: 0 }),
    is_available: f.bool({ default: true }),
    is_featured: f.bool({ default: false }),
    allergens: f.text({ array: true }),
    weight_or_size: f.text({ default: "" }),
    // denormalised from approved reviews / paid orders so lists can sort on them
    rating_avg: f.decimal({ default: 0 }),
    rating_count: f.int({ default: 0 }),
    sales_count: f.int({ default: 0 }),
  },
  index: [
    { type: "unique", fields: [{ name: "slug" }] },
    { type: "btree", fields: [{ name: "category_id" }] },
  ],
  seed: seed.products as never,
});

export const productVariants = table({
  name: "product_variants",
  schema: {
    product_id: f.tableRef(products, { required: true }),
    label: f.text({ required: true }),
    price_delta: f.decimal({ default: 0 }),
    stock_qty: f.int({ default: 0 }),
  },
  index: [{ type: "btree", fields: [{ name: "product_id" }] }],
  seed: seed.variants as never,
});

export const carts = table({
  name: "carts",
  schema: {
    user_id: f.tableRef(users, { required: true }),
    coupon_code: f.text({ default: "" }),
  },
  index: [{ type: "unique", fields: [{ name: "user_id" }] }],
  seed: seedFile("./seed/carts.json", import.meta.url),
});

export const cartItems = table({
  name: "cart_items",
  schema: {
    cart_id: f.tableRef(carts, { required: true }),
    product_id: f.tableRef(products, { required: true }),
    variant_id: f.int({ default: 0 }),
    quantity: f.int({ required: true }),
    unit_price: f.decimal({ default: 0 }),
  },
  index: [{ type: "btree", fields: [{ name: "cart_id" }] }],
  seed: seedFile("./seed/cart_items.json", import.meta.url),
});

export const orders = table({
  name: "orders",
  schema: {
    user_id: f.tableRef(users, { required: true }),
    order_number: f.text({ required: true }),
    status: f.enum(
      ["pending", "paid", "preparing", "out_for_delivery", "delivered", "cancelled", "refunded"],
      { default: "pending" },
    ),
    subtotal: f.decimal({ default: 0 }),
    tax: f.decimal({ default: 0 }),
    delivery_fee: f.decimal({ default: 0 }),
    discount: f.decimal({ default: 0 }),
    total: f.decimal({ default: 0 }),
    coupon_code: f.text({ default: "" }),
    delivery_type: f.enum(["pickup", "delivery"], { default: "pickup" }),
    delivery_date: f.date({ nullable: true }),
    delivery_slot: f.text({ default: "" }),
    address_id: f.int({ default: 0 }),
    address_text: f.text({ default: "" }),
    notes: f.text({ default: "" }),
    paid_at: f.timestamp({ nullable: true }),
  },
  index: [
    { type: "unique", fields: [{ name: "order_number" }] },
    { type: "btree", fields: [{ name: "user_id" }] },
    { type: "btree", fields: [{ name: "status" }] },
  ],
  seed: seed.orders as never,
});

export const orderItems = table({
  name: "order_items",
  schema: {
    order_id: f.tableRef(orders, { required: true }),
    product_id: f.int({ required: true }),
    variant_id: f.int({ default: 0 }),
    name_snapshot: f.text({ required: true }),
    unit_price: f.decimal({ default: 0 }),
    quantity: f.int({ default: 1 }),
    line_total: f.decimal({ default: 0 }),
  },
  index: [{ type: "btree", fields: [{ name: "order_id" }] }],
  seed: seed.orderItems as never,
});

export const payments = table({
  name: "payments",
  schema: {
    order_id: f.tableRef(orders, { required: true }),
    provider: f.text({ default: "stripe" }),
    provider_ref: f.text({ default: "" }),
    amount: f.decimal({ default: 0 }),
    status: f.enum(["initiated", "succeeded", "failed", "refunded"], { default: "initiated" }),
  },
  index: [{ type: "btree", fields: [{ name: "order_id" }] }],
  seed: seed.payments as never,
});

export const reviews = table({
  name: "reviews",
  schema: {
    product_id: f.tableRef(products, { required: true }),
    user_id: f.tableRef(users, { required: true }),
    author_name: f.text({ default: "" }),
    order_id: f.int({ default: 0 }),
    rating: f.int({ required: true }),
    title: f.text({ default: "" }),
    body: f.text({ default: "" }),
    is_approved: f.bool({ default: false }),
  },
  index: [{ type: "btree", fields: [{ name: "product_id" }] }],
  seed: seed.reviews as never,
});

export const coupons = table({
  name: "coupons",
  schema: {
    code: f.text({ required: true, methods: ["trim", "upper"] }),
    type: f.enum(["percent", "flat"], { default: "percent" }),
    value: f.decimal({ required: true }),
    min_order: f.decimal({ default: 0 }),
    valid_from: f.timestamp({ nullable: true }),
    valid_to: f.timestamp({ nullable: true }),
    usage_limit: f.int({ default: 0 }),
    is_active: f.bool({ default: true }),
  },
  index: [{ type: "unique", fields: [{ name: "code" }] }],
  seed: seed.coupons as never,
});

// Only the SHA-256 of a reset token is stored; the token itself goes to the shopper.
export const passwordResets = table({
  name: "password_resets",
  schema: {
    user_id: f.tableRef(users, { required: true }),
    token_hash: f.text({ required: true }),
    expires_at: f.int({ required: true }),
    used: f.bool({ default: false }),
  },
  index: [{ type: "unique", fields: [{ name: "token_hash" }] }],
  seed: seedFile("./seed/password_resets.json", import.meta.url),
});

export const allTables = [
  users, addresses, categories, products, productVariants, carts, cartItems,
  orders, orderItems, payments, reviews, coupons, passwordResets,
];
