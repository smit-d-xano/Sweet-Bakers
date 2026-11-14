import { apiGroup, query, input, f, s, ref, inp, auth, c, col, expr, cmp, obj, withFilters, fl, env, cond, guard } from "@xano/sdk";
import { lam } from "@xano/sdk/node";
import { users, categories, products, productVariants, orders, orderItems, payments, reviews, coupons, cartItems } from "../tables.js";
import { refreshRating, restockOrder } from "../functions.js";

export const adminApi = apiGroup({ name: "sweetbakers_admin", canonical: "sweetbakers-admin" });

const admin = () => guard.role(users, "admin");
const helpers = lam.file("../lambdas/helpers.ts");

const productFields = {
  category_id: input.int({ required: true }),
  name: input.text({ required: true }),
  description: input.text({ nullable: true }),
  price: input.decimal({ required: true }),
  images: input.list(input.text(), { required: true }),
  stock_qty: input.int({ default: 0 }),
  is_available: input.bool({ default: true }),
  is_featured: input.bool({ default: false }),
  allergens: input.list(input.text(), { required: true }),
  weight_or_size: input.text({ nullable: true }),
};

const productRow = {
  category_id: inp("category_id"),
  name: inp("name"),
  description: withFilters(inp("description"), fl.first_notempty("")),
  price: inp("price"),
  images: inp("images"),
  stock_qty: inp("stock_qty"),
  is_available: inp("is_available"),
  is_featured: inp("is_featured"),
  allergens: inp("allergens"),
  weight_or_size: withFilters(inp("weight_or_size"), fl.first_notempty("")),
};

const validProduct = [
  s.precondition({ expr: expr(inp("price"), ">=", c.int(0)), error: c.text("Price cannot be negative."), error_type: "inputerror" }),
  s.precondition({ expr: expr(inp("stock_qty"), ">=", c.int(0)), error: c.text("Stock cannot be negative."), error_type: "inputerror" }),
  s.precondition({ expr: expr(withFilters(inp("name"), fl.trim(), fl.strlen()), ">", c.int(0)), error: c.text("Please enter a product name."), error_type: "inputerror" }),
];

// ---------- products ----------

const adminListProducts = query({
  name: "admin/products",
  verb: "GET",
  apiGroup: adminApi,
  auth: users,
  input: { q: input.text({ default: "" }), category_id: input.int({ default: 0 }), page: input.int({ default: 1 }), per_page: input.int({ default: 20 }) },
  stack: [
    ...admin(),
    s.db.query({
      table: products,
      where: [cmp(col("name"), "includes", inp("q"), { ignoreEmpty: true }), cmp(col("category_id"), "=", inp("category_id"), { ignoreEmpty: true })],
      sort: [{ sortBy: "id", dir: "asc" }],
      paging: { page: inp("page"), per_page: inp("per_page"), totals: true },
      as: "rows",
    }),
  ],
  response: ref("rows"),
});

const adminGetProduct = query({
  name: "admin/products/{id}",
  verb: "GET",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }) },
  stack: [
    ...admin(),
    s.db.get({ table: products, fieldValue: inp("id"), as: "p" }),
    guard.found("p", { message: "Product not found." }),
    s.db.query({ table: productVariants, where: expr(col("product_id"), "=", inp("id")), sort: [{ sortBy: "id", dir: "asc" }], as: "variants" }),
  ],
  response: { product: ref("p"), variants: ref("variants") },
});

const adminCreateProduct = query({
  name: "admin/products",
  verb: "POST",
  apiGroup: adminApi,
  auth: users,
  input: productFields,
  stack: [
    ...admin(),
    ...validProduct,
    s.set_var("op", c.text("slug")),
    s.set_var("name", inp("name")),
    s.lambda({ as: "sl", code: helpers }),
    s.db.has({ table: products, fieldName: "slug", fieldValue: ref("sl.slug"), as: "taken" }),
    s.precondition({ expr: expr(ref("taken"), "==", c.bool(false)), error: c.text("A product with that name already exists."), error_type: "inputerror" }),
    s.db.add({ table: products, row: { ...productRow, slug: ref("sl.slug") }, as: "product" }),
  ],
  response: ref("product"),
});

const adminUpdateProduct = query({
  name: "admin/products/{id}",
  verb: "PUT",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }), ...productFields },
  stack: [
    ...admin(),
    ...validProduct,
    s.db.get({ table: products, fieldValue: inp("id"), as: "existing" }),
    guard.found("existing", { message: "Product not found." }),
    s.db.edit({ table: products, fieldValue: inp("id"), row: productRow, as: "product" }),
  ],
  response: ref("product"),
});

const adminDeleteProduct = query({
  name: "admin/products/{id}",
  verb: "DELETE",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }) },
  stack: [
    ...admin(),
    s.db.get({ table: products, fieldValue: inp("id"), as: "existing" }),
    guard.found("existing", { message: "Product not found." }),
    s.db.query({ table: productVariants, where: expr(col("product_id"), "=", inp("id")), as: "vs" }),
    s.foreach({ as: "v", list: ref("vs"), body: [s.db.del({ table: productVariants, fieldValue: ref("v.id") })] }),
    s.db.query({ table: reviews, where: expr(col("product_id"), "=", inp("id")), as: "rs" }),
    s.foreach({ as: "r", list: ref("rs"), body: [s.db.del({ table: reviews, fieldValue: ref("r.id") })] }),
    s.db.query({ table: cartItems, where: expr(col("product_id"), "=", inp("id")), as: "cs" }),
    s.foreach({ as: "ci", list: ref("cs"), body: [s.db.del({ table: cartItems, fieldValue: ref("ci.id") })] }),
    s.db.del({ table: products, fieldValue: inp("id") }),
  ],
  response: { deleted: c.bool(true) },
});

const adminUpload = query({
  name: "admin/upload",
  verb: "POST",
  apiGroup: adminApi,
  auth: users,
  input: { file: input.file({ required: true }) },
  stack: [...admin(), s.storage.create_image({ value: inp("file"), as: "img" })],
  response: { path: ref("img.path") },
});

// ---------- variants ----------

const variantFields = { label: input.text({ required: true }), price_delta: input.decimal({ default: 0 }), stock_qty: input.int({ default: 0 }) };

const adminAddVariant = query({
  name: "admin/products/{id}/variants",
  verb: "POST",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }), ...variantFields },
  stack: [
    ...admin(),
    s.db.get({ table: products, fieldValue: inp("id"), as: "p" }),
    guard.found("p", { message: "Product not found." }),
    s.db.add({ table: productVariants, row: { product_id: inp("id"), label: inp("label"), price_delta: inp("price_delta"), stock_qty: inp("stock_qty") }, as: "variant" }),
  ],
  response: ref("variant"),
});

const adminUpdateVariant = query({
  name: "admin/variants/{id}",
  verb: "PUT",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }), ...variantFields },
  stack: [
    ...admin(),
    s.db.get({ table: productVariants, fieldValue: inp("id"), as: "existing" }),
    guard.found("existing", { message: "Variant not found." }),
    s.db.edit({ table: productVariants, fieldValue: inp("id"), row: { label: inp("label"), price_delta: inp("price_delta"), stock_qty: inp("stock_qty") }, as: "variant" }),
  ],
  response: ref("variant"),
});

const adminDeleteVariant = query({
  name: "admin/variants/{id}",
  verb: "DELETE",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }) },
  stack: [
    ...admin(),
    s.db.get({ table: productVariants, fieldValue: inp("id"), as: "existing" }),
    guard.found("existing", { message: "Variant not found." }),
    s.db.del({ table: productVariants, fieldValue: inp("id") }),
  ],
  response: { deleted: c.bool(true) },
});

// ---------- categories ----------

const categoryFields = { name: input.text({ required: true }), description: input.text({ default: "" }) };

const adminCreateCategory = query({
  name: "admin/categories",
  verb: "POST",
  apiGroup: adminApi,
  auth: users,
  input: categoryFields,
  stack: [
    ...admin(),
    s.set_var("op", c.text("slug")),
    s.set_var("name", inp("name")),
    s.lambda({ as: "sl", code: helpers }),
    s.db.has({ table: categories, fieldName: "slug", fieldValue: ref("sl.slug"), as: "taken" }),
    s.precondition({ expr: expr(ref("taken"), "==", c.bool(false)), error: c.text("A category with that name already exists."), error_type: "inputerror" }),
    s.db.add({ table: categories, row: { name: inp("name"), slug: ref("sl.slug"), description: withFilters(inp("description"), fl.first_notempty("")) }, as: "category" }),
  ],
  response: ref("category"),
});

const adminUpdateCategory = query({
  name: "admin/categories/{id}",
  verb: "PUT",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }), ...categoryFields },
  stack: [
    ...admin(),
    s.db.get({ table: categories, fieldValue: inp("id"), as: "existing" }),
    guard.found("existing", { message: "Category not found." }),
    s.db.edit({ table: categories, fieldValue: inp("id"), row: { name: inp("name"), description: withFilters(inp("description"), fl.first_notempty("")) }, as: "category" }),
  ],
  response: ref("category"),
});

const adminDeleteCategory = query({
  name: "admin/categories/{id}",
  verb: "DELETE",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }) },
  stack: [
    ...admin(),
    s.db.get({ table: categories, fieldValue: inp("id"), as: "existing" }),
    guard.found("existing", { message: "Category not found." }),
    s.db.query({ table: products, where: expr(col("category_id"), "=", inp("id")), returnType: "count", as: "n" }),
    s.precondition({ expr: expr(ref("n"), "==", c.int(0)), error: c.text("Move or delete this category's products first."), error_type: "inputerror" }),
    s.db.del({ table: categories, fieldValue: inp("id") }),
  ],
  response: { deleted: c.bool(true) },
});

// ---------- orders ----------

const adminListOrders = query({
  name: "admin/orders",
  verb: "GET",
  apiGroup: adminApi,
  auth: users,
  input: {
    status: input.text({ default: "" }),
    from: input.text({ default: "" }),
    to: input.text({ default: "" }),
    q: input.text({ default: "" }),
    page: input.int({ default: 1 }),
    per_page: input.int({ default: 20 }),
  },
  stack: [
    ...admin(),
    s.set_var("op", c.text("range")),
    s.set_var("from", inp("from")),
    s.set_var("to", inp("to")),
    s.lambda({ as: "rng", code: helpers }),
    s.db.query({
      table: orders,
      where: [
        cmp(col("status"), "=", inp("status"), { ignoreEmpty: true }),
        cmp(col("created_at"), ">=", ref("rng.from_ms"), { ignoreEmpty: true }),
        cmp(col("created_at"), "<=", ref("rng.to_ms"), { ignoreEmpty: true }),
        cmp(col("order_number"), "includes", inp("q"), { ignoreEmpty: true }),
      ],
      bind: [{ table: users, as: "u", join: "left", where: expr(col("user_id"), "=", col("u.id")) }],
      eval: [{ name: "u.name", as: "customer_name" }],
      sort: [{ sortBy: "created_at", dir: "desc" }],
      paging: { page: inp("page"), per_page: inp("per_page"), totals: true },
      as: "rows",
    }),
  ],
  response: ref("rows"),
});

const adminOrderDetail = query({
  name: "admin/orders/{id}",
  verb: "GET",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }) },
  stack: [
    ...admin(),
    s.db.get({ table: orders, fieldValue: inp("id"), as: "order" }),
    guard.found("order", { message: "Order not found." }),
    s.db.query({ table: orderItems, where: expr(col("order_id"), "=", inp("id")), sort: [{ sortBy: "id", dir: "asc" }], as: "items" }),
    s.db.query({ table: payments, where: expr(col("order_id"), "=", inp("id")), returnType: "single", as: "payment" }),
    s.db.get({ table: users, fieldValue: ref("order.user_id"), output: ["id", "name", "email", "phone"], as: "customer" }),
  ],
  response: { order: ref("order"), items: ref("items"), payment: ref("payment"), customer: ref("customer") },
});

const adminSetStatus = query({
  name: "admin/orders/{id}/status",
  verb: "PUT",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }), status: input.enum(["preparing", "out_for_delivery", "delivered", "cancelled"], { required: true }) },
  stack: [
    ...admin(),
    s.db.get({ table: orders, fieldValue: inp("id"), as: "order" }),
    guard.found("order", { message: "Order not found." }),
    s.set_var("op", c.text("transition")),
    s.set_var("current", ref("order.status")),
    s.set_var("next", inp("status")),
    s.lambda({ as: "t", code: helpers }),
    s.precondition({ expr: expr(ref("t.ok"), "==", c.bool(true)), error: ref("t.error"), error_type: "inputerror" }),
    s.conditional({
      when: expr(inp("status"), "==", c.text("cancelled")),
      then: [
        s.conditional({
          when: expr(ref("order.status"), "!=", c.text("pending")),
          then: [s.function.run({ fn: restockOrder, input: { order_id: inp("id") }, as: "restocked" })],
        }),
        s.db.query({ table: payments, where: expr(col("order_id"), "=", inp("id")), returnType: "single", as: "pay" }),
        s.conditional({
          when: expr(ref("pay"), "!=", c.null()),
          then: [s.conditional({ when: expr(ref("pay.status"), "==", c.text("initiated")), then: [s.db.edit({ table: payments, fieldValue: ref("pay.id"), row: { status: "failed" } })] })],
        }),
      ],
    }),
    s.db.edit({ table: orders, fieldValue: inp("id"), row: { status: inp("status") }, as: "updated" }),
  ],
  response: ref("updated"),
});

const adminRefund = query({
  name: "admin/orders/{id}/refund",
  verb: "POST",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }) },
  stack: [
    ...admin(),
    s.db.get({ table: orders, fieldValue: inp("id"), as: "order" }),
    guard.found("order", { message: "Order not found." }),
    s.precondition({
      expr: cond.in(ref("order.status"), c.array(["paid", "preparing", "out_for_delivery", "delivered"])),
      error: c.text("Only paid orders can be refunded."),
      error_type: "inputerror",
    }),
    s.db.query({ table: payments, where: expr(col("order_id"), "=", inp("id")), returnType: "single", as: "pay" }),
    s.conditional({
      when: cond.notEmpty(env("STRIPE_SECRET_KEY")),
      then: [
        s.conditional({
          when: expr(ref("pay"), "!=", c.null()),
          then: [
            s.conditional({
              when: cond.startsWith(ref("pay.provider_ref"), c.text("pi_")),
              then: [
                s.set_var("req", obj({ op: c.text("refund"), payment_intent: ref("pay.provider_ref") })),
                s.lambda({ as: "st", code: lam.file("../lambdas/stripe_call.ts") }),
                s.precondition({ expr: expr(ref("st.ok", { safe: true }), "==", c.bool(true)), error: c.text("Stripe could not refund this payment."), error_type: "badrequest" }),
              ],
            }),
          ],
        }),
      ],
    }),
    s.conditional({
      when: expr(ref("pay"), "!=", c.null()),
      then: [s.db.edit({ table: payments, fieldValue: ref("pay.id"), row: { status: "refunded" } })],
    }),
    s.function.run({ fn: restockOrder, input: { order_id: inp("id") }, as: "restocked" }),
    s.db.edit({ table: orders, fieldValue: inp("id"), row: { status: "refunded" }, as: "updated" }),
  ],
  response: ref("updated"),
});

// ---------- reviews ----------

const reviewList = (status: string, where: ReturnType<typeof expr> | undefined) => ({
  when: expr(inp("status"), "==", c.text(status)),
  then: [
    s.db.query({
      table: reviews,
      where,
      bind: [{ table: products, as: "pr", join: "left", where: expr(col("product_id"), "=", col("pr.id")) }],
      eval: [{ name: "pr.name", as: "product_name" }],
      sort: [{ sortBy: "created_at", dir: "desc" }],
      paging: { page: inp("page"), per_page: inp("per_page"), totals: true },
      as: `rv_${status}`,
    }),
    s.set_var("res", ref(`rv_${status}`)),
  ],
});

const adminListReviews = query({
  name: "admin/reviews",
  verb: "GET",
  apiGroup: adminApi,
  auth: users,
  input: { status: input.text({ default: "pending" }), page: input.int({ default: 1 }), per_page: input.int({ default: 20 }) },
  stack: [
    ...admin(),
    s.set_var("res", c.null()),
    s.conditional({
      ...reviewList("pending", expr(col("is_approved"), "=", c.bool(false))),
      elif: [reviewList("approved", expr(col("is_approved"), "=", c.bool(true)))],
      else: [
        s.db.query({
          table: reviews,
          bind: [{ table: products, as: "pr", join: "left", where: expr(col("product_id"), "=", col("pr.id")) }],
          eval: [{ name: "pr.name", as: "product_name" }],
          sort: [{ sortBy: "created_at", dir: "desc" }],
          paging: { page: inp("page"), per_page: inp("per_page"), totals: true },
          as: "rv_all",
        }),
        s.set_var("res", ref("rv_all")),
      ],
    }),
  ],
  response: ref("res"),
});

const adminSetReviewApproval = query({
  name: "admin/reviews/{id}/approval",
  verb: "PUT",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }), approved: input.bool({ default: false }) },
  stack: [
    ...admin(),
    s.db.get({ table: reviews, fieldValue: inp("id"), as: "existing" }),
    guard.found("existing", { message: "Review not found." }),
    s.db.edit({ table: reviews, fieldValue: inp("id"), row: { is_approved: inp("approved") }, as: "review" }),
    s.function.run({ fn: refreshRating, input: { product_id: ref("existing.product_id") }, as: "rating" }),
  ],
  response: ref("review"),
});

const adminDeleteReview = query({
  name: "admin/reviews/{id}",
  verb: "DELETE",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }) },
  stack: [
    ...admin(),
    s.db.get({ table: reviews, fieldValue: inp("id"), as: "existing" }),
    guard.found("existing", { message: "Review not found." }),
    s.db.del({ table: reviews, fieldValue: inp("id") }),
    s.function.run({ fn: refreshRating, input: { product_id: ref("existing.product_id") }, as: "rating" }),
  ],
  response: { deleted: c.bool(true) },
});

// ---------- coupons ----------

const couponFields = {
  type: input.enum(["percent", "flat"], { required: true }),
  value: input.decimal({ required: true }),
  min_order: input.decimal({ default: 0 }),
  valid_from: input.timestamp({ nullable: true }),
  valid_to: input.timestamp({ nullable: true }),
  usage_limit: input.int({ default: 0 }),
  is_active: input.bool({ default: true }),
};

const couponRow = {
  type: inp("type"),
  value: inp("value"),
  min_order: inp("min_order"),
  valid_from: inp("valid_from"),
  valid_to: inp("valid_to"),
  usage_limit: inp("usage_limit"),
  is_active: inp("is_active"),
};

const validCoupon = [
  s.precondition({ expr: expr(inp("value"), ">", c.int(0)), error: c.text("Value must be greater than zero."), error_type: "inputerror" }),
];

const adminListCoupons = query({
  name: "admin/coupons",
  verb: "GET",
  apiGroup: adminApi,
  auth: users,
  stack: [...admin(), s.db.query({ table: coupons, sort: [{ sortBy: "id", dir: "desc" }], as: "rows" })],
  response: ref("rows"),
});

const adminCreateCoupon = query({
  name: "admin/coupons",
  verb: "POST",
  apiGroup: adminApi,
  auth: users,
  input: { code: input.text({ required: true }), ...couponFields },
  stack: [
    ...admin(),
    ...validCoupon,
    s.set_var("code", withFilters(inp("code"), fl.trim(), fl.upper())),
    s.precondition({ expr: expr(withFilters(ref("code"), fl.strlen()), ">", c.int(0)), error: c.text("Enter a coupon code."), error_type: "inputerror" }),
    s.db.has({ table: coupons, fieldName: "code", fieldValue: ref("code"), as: "taken" }),
    s.precondition({ expr: expr(ref("taken"), "==", c.bool(false)), error: c.text("That coupon code already exists."), error_type: "inputerror" }),
    s.db.add({ table: coupons, row: { code: ref("code"), ...couponRow }, as: "coupon" }),
  ],
  response: ref("coupon"),
});

const adminUpdateCoupon = query({
  name: "admin/coupons/{id}",
  verb: "PUT",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }), ...couponFields },
  stack: [
    ...admin(),
    ...validCoupon,
    s.db.get({ table: coupons, fieldValue: inp("id"), as: "existing" }),
    guard.found("existing", { message: "Coupon not found." }),
    s.db.edit({ table: coupons, fieldValue: inp("id"), row: couponRow, as: "coupon" }),
  ],
  response: ref("coupon"),
});

const adminDeleteCoupon = query({
  name: "admin/coupons/{id}",
  verb: "DELETE",
  apiGroup: adminApi,
  auth: users,
  input: { id: input.int({ required: true }) },
  stack: [
    ...admin(),
    s.db.get({ table: coupons, fieldValue: inp("id"), as: "existing" }),
    guard.found("existing", { message: "Coupon not found." }),
    s.db.del({ table: coupons, fieldValue: inp("id") }),
  ],
  response: { deleted: c.bool(true) },
});

// ---------- dashboard ----------

const dashboardSummary = query({
  name: "admin/dashboard/summary",
  verb: "GET",
  apiGroup: adminApi,
  auth: users,
  input: { period: input.text({ default: "day" }), from: input.text({ default: "" }), to: input.text({ default: "" }) },
  stack: [
    ...admin(),
    s.lambda({ as: "range", code: lam.file("../lambdas/dashboard_range.ts") }),
    s.db.query({
      table: orders,
      where: [expr(col("created_at"), ">=", ref("range.prev_start")), expr(col("created_at"), "<", ref("range.end"))],
      as: "orders",
    }),
    s.array.map({ source: ref("orders"), transform: ref("$this.id"), as: "oids" }),
    s.set_var("items", c.array([])),
    s.conditional({
      when: expr(withFilters(ref("oids"), fl.count()), ">", c.int(0)),
      then: [s.db.query({ table: orderItems, where: cmp(col("order_id"), "in", ref("oids")), as: "item_rows" }), s.set_var("items", ref("item_rows"))],
    }),
    s.db.query({ table: products, as: "products" }),
    s.db.query({ table: categories, as: "categories" }),
    s.db.query({ table: users, as: "users" }),
    s.db.query({
      table: orders,
      sort: [{ sortBy: "created_at", dir: "desc" }],
      paging: { page: c.int(1), per_page: c.int(8), metadata: false },
      as: "latest_orders",
    }),
    s.db.query({
      table: products,
      where: expr(col("stock_qty"), "<", c.int(10)),
      sort: [{ sortBy: "stock_qty", dir: "asc" }],
      paging: { page: c.int(1), per_page: c.int(10), metadata: false },
      as: "low_stock",
    }),
    s.db.query({
      table: reviews,
      sort: [{ sortBy: "created_at", dir: "desc" }],
      paging: { page: c.int(1), per_page: c.int(6), metadata: false },
      as: "latest_reviews",
    }),
    s.lambda({ as: "summary", code: lam.file("../lambdas/dashboard.ts") }),
  ],
  response: ref("summary"),
});

export const adminQueries = [
  adminListProducts, adminGetProduct, adminCreateProduct, adminUpdateProduct, adminDeleteProduct, adminUpload,
  adminAddVariant, adminUpdateVariant, adminDeleteVariant,
  adminCreateCategory, adminUpdateCategory, adminDeleteCategory,
  adminListOrders, adminOrderDetail, adminSetStatus, adminRefund,
  adminListReviews, adminSetReviewApproval, adminDeleteReview,
  adminListCoupons, adminCreateCoupon, adminUpdateCoupon, adminDeleteCoupon,
  dashboardSummary,
];
void auth;
void f;
