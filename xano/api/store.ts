import { apiGroup, query, input, f, s, ref, inp, auth, c, col, expr, cmp, obj, withFilters, fl, env, cond, guard, sys } from "@xano/sdk";
import { lam } from "@xano/sdk/node";
import {
  users, addresses, carts, cartItems, categories, products, productVariants, orders, orderItems, payments, reviews, passwordResets,
} from "../tables.js";
import { priceCart, fulfillPayment, failPayment, reviewEligibility } from "../functions.js";

export const storeApi = apiGroup({ name: "sweetbakers", canonical: "sweetbakers" });

const itemsInput = input.list(input.object({ product_id: f.int(), variant_id: f.int(), quantity: f.int() }));

// ---------- auth ----------

const signup = query({
  name: "auth/signup",
  verb: "POST",
  apiGroup: storeApi,
  input: {
    name: input.text({ required: true }),
    email: input.email({ required: true }),
    password: input.text({ required: true }),
    phone: input.text({ default: "" }),
  },
  stack: [
    s.set_var("email", withFilters(inp("email"), fl.trim(), fl.lower())),
    s.precondition({
      expr: expr(withFilters(inp("password"), fl.strlen()), ">=", c.int(8)),
      error: c.text("Password must be at least 8 characters."),
      error_type: "inputerror",
    }),
    s.precondition({
      expr: expr(withFilters(inp("name"), fl.trim(), fl.strlen()), ">", c.int(0)),
      error: c.text("Please enter your name."),
      error_type: "inputerror",
    }),
    s.db.has({ table: users, fieldName: "email", fieldValue: ref("email"), as: "exists" }),
    s.precondition({
      expr: expr(ref("exists"), "==", c.bool(false)),
      error: c.text("An account with that email already exists."),
      error_type: "inputerror",
    }),
    s.db.add({
      table: users,
      row: { name: inp("name"), email: ref("email"), password: inp("password"), phone: inp("phone"), role: "customer" },
      output: ["id", "name", "email", "phone", "role", "created_at"],
      as: "user",
    }),
    s.security.create_auth_token({ table: users, id: ref("user.id"), as: "token" }),
  ],
  response: { token: ref("token"), user: ref("user") },
});

const login = query({
  name: "auth/login",
  verb: "POST",
  apiGroup: storeApi,
  input: { email: input.text({ required: true }), password: input.text({ required: true }) },
  stack: [
    s.set_var("email", withFilters(inp("email"), fl.trim(), fl.lower())),
    s.db.get({ table: users, fieldName: "email", fieldValue: ref("email"), output: ["id", "name", "email", "phone", "role", "created_at", "password"], as: "u" }),
    s.precondition({
      expr: expr(ref("u", { safe: true }), "!=", c.null()),
      error: c.text("Invalid email or password."),
      error_type: "unauthorized",
    }),
    s.security.check_password({ text_password: inp("password"), hash_password: ref("u.password"), as: "ok" }),
    s.precondition({
      expr: expr(ref("ok"), "==", c.bool(true)),
      error: c.text("Invalid email or password."),
      error_type: "unauthorized",
    }),
    s.security.create_auth_token({ table: users, id: ref("u.id"), as: "token" }),
  ],
  response: {
    token: ref("token"),
    user: obj({ id: ref("u.id"), name: ref("u.name"), email: ref("u.email"), phone: ref("u.phone"), role: ref("u.role"), created_at: ref("u.created_at") }),
  },
});

const me = query({
  name: "auth/me",
  verb: "GET",
  apiGroup: storeApi,
  auth: users,
  stack: [s.db.get({ table: users, fieldValue: auth("id"), output: ["id", "name", "email", "phone", "role", "created_at"], as: "user" })],
  response: ref("user"),
});

const forgotPassword = query({
  name: "auth/forgot_password",
  verb: "POST",
  apiGroup: storeApi,
  input: { email: input.text({ required: true }) },
  stack: [
    s.set_var("email", withFilters(inp("email"), fl.trim(), fl.lower())),
    s.set_var("demo_token", c.text("")),
    s.db.get({ table: users, fieldName: "email", fieldValue: ref("email"), output: ["id", "name", "email", "role"], as: "u" }),
    s.conditional({
      when: expr(ref("u", { safe: true }), "!=", c.null()),
      then: [
        s.security.random_bytes({ length: c.int(32), as: "raw" }),
        s.set_var("reset_token", withFilters(ref("raw"), fl.bin2hex())),
        s.set_var("expires", withFilters(c.now(), fl.add(3600000))),
        s.db.add({
          table: passwordResets,
          row: { user_id: ref("u.id"), token_hash: withFilters(ref("reset_token"), fl.sha256()), expires_at: ref("expires"), used: false },
          output: ["id"],
          as: "pr",
        }),
        s.conditional({
          when: cond.notEmpty(env("RESEND_API_KEY")),
          then: [
            s.conditional({
              when: cond.notEmpty(env("APP_URL")),
              then: [
                s.set_var("base_url", env("APP_URL")),
                s.set_var("op", c.text("reset_email")),
                s.set_var("user", ref("u")),
                s.lambda({ as: "mail", code: lam.file("../lambdas/helpers.ts") }),
                s.util.send_email({
                  service_provider: "resend",
                  api_key: env("RESEND_API_KEY"),
                  to: ref("u.email"),
                  from: c.text("SweetBakers <orders@sweetbakers.example>"),
                  subject: ref("mail.subject"),
                  message: ref("mail.message"),
                  as: "mail_result",
                }),
              ],
            }),
          ],
          // Demo mode (no email service): hand the token back so the flow can be tried. Never for the owner account.
          else: [
            s.conditional({
              when: expr(ref("u.role"), "==", c.text("customer")),
              then: [s.set_var("demo_token", ref("reset_token"))],
            }),
          ],
        }),
      ],
    }),
  ],
  response: { ok: c.bool(true), reset_token: ref("demo_token") },
});

const resetPassword = query({
  name: "auth/reset_password",
  verb: "POST",
  apiGroup: storeApi,
  input: { token: input.text({ required: true }), password: input.text({ required: true }) },
  stack: [
    s.precondition({
      expr: expr(withFilters(inp("password"), fl.strlen()), ">=", c.int(8)),
      error: c.text("Password must be at least 8 characters."),
      error_type: "inputerror",
    }),
    s.set_var("hash", withFilters(inp("token"), fl.trim(), fl.sha256())),
    s.db.get({ table: passwordResets, fieldName: "token_hash", fieldValue: ref("hash"), as: "pr" }),
    s.set_var("now_ms", c.now()),
    s.precondition({
      expr: expr(ref("pr", { safe: true }), "!=", c.null()),
      error: c.text("This reset link is invalid or has expired."),
      error_type: "inputerror",
    }),
    s.precondition({
      expr: expr(ref("pr.used"), "==", c.bool(false)),
      error: c.text("This reset link is invalid or has expired."),
      error_type: "inputerror",
    }),
    s.precondition({
      expr: expr(ref("pr.expires_at"), ">", ref("now_ms")),
      error: c.text("This reset link is invalid or has expired."),
      error_type: "inputerror",
    }),
    s.db.edit({ table: users, fieldValue: ref("pr.user_id"), row: { password: inp("password") } }),
    s.db.edit({ table: passwordResets, fieldValue: ref("pr.id"), row: { used: true } }),
  ],
  response: { ok: c.bool(true) },
});

const updateProfile = query({
  name: "profile",
  verb: "PUT",
  apiGroup: storeApi,
  auth: users,
  input: { name: input.text({ required: true }), phone: input.text({ nullable: true }) },
  stack: [
    s.precondition({
      expr: expr(withFilters(inp("name"), fl.trim(), fl.strlen()), ">", c.int(0)),
      error: c.text("Please enter your name."),
      error_type: "inputerror",
    }),
    s.db.edit({
      table: users,
      fieldValue: auth("id"),
      row: { name: inp("name"), phone: withFilters(inp("phone"), fl.first_notempty("")) },
      output: ["id", "name", "email", "phone", "role", "created_at"],
      as: "user",
    }),
  ],
  response: ref("user"),
});

// ---------- catalogue ----------

const storeConfig = query({
  name: "store/config",
  verb: "GET",
  apiGroup: storeApi,
  stack: [
    s.set_var("payment_mode", c.text("demo")),
    s.conditional({ when: cond.notEmpty(env("STRIPE_SECRET_KEY")), then: [s.set_var("payment_mode", c.text("stripe"))] }),
  ],
  response: {
    name: c.text("SweetBakers"),
    timezone: c.text("America/New_York"),
    tax_rate: c.decimal(0.08),
    delivery_fee: c.decimal(5),
    free_delivery_over: c.decimal(50),
    low_stock_threshold: c.int(10),
    slots: c.array(["09:00 - 12:00", "12:00 - 15:00", "15:00 - 18:00"]),
    payment_mode: ref("payment_mode"),
  },
});

const listCategories = query({
  name: "categories",
  verb: "GET",
  apiGroup: storeApi,
  stack: [s.db.query({ table: categories, sort: [{ sortBy: "id", dir: "asc" }], as: "rows" })],
  response: ref("rows"),
});

const SORTS: Array<[string, "created_at" | "price" | "rating_avg" | "sales_count", "asc" | "desc"]> = [
  ["newest", "created_at", "desc"],
  ["price_asc", "price", "asc"],
  ["price_desc", "price", "desc"],
  ["rating", "rating_avg", "desc"],
  ["popular", "sales_count", "desc"],
];

const productFilters = [
  cmp(col("name"), "includes", inp("q"), { ignoreEmpty: true }),
  cmp(col("category_id"), "=", inp("category_id"), { ignoreEmpty: true }),
  cmp(col("price"), ">=", inp("min_price"), { ignoreEmpty: true }),
  cmp(col("price"), "<=", inp("max_price"), { ignoreEmpty: true }),
  expr(col("stock_qty"), ">=", ref("min_stock")),
];

const listProducts = query({
  name: "products",
  verb: "GET",
  apiGroup: storeApi,
  input: {
    q: input.text({ default: "" }),
    category_id: input.int({ default: 0 }),
    min_price: input.decimal({ default: 0 }),
    max_price: input.decimal({ default: 0 }),
    in_stock: input.bool({ default: false }),
    sort: input.text({ default: "newest" }),
    page: input.int({ default: 1 }),
    per_page: input.int({ default: 12 }),
  },
  stack: [
    s.set_var("min_stock", c.int(0)),
    s.conditional({ when: expr(inp("in_stock"), "==", c.bool(true)), then: [s.set_var("min_stock", c.int(1))] }),
    s.set_var("res", c.null()),
    s.conditional({
      when: expr(inp("sort"), "==", c.text(SORTS[1][0])),
      then: [
        s.db.query({
          table: products,
          where: productFilters,
          sort: [{ sortBy: SORTS[1][1], dir: SORTS[1][2] }],
          paging: { page: inp("page"), per_page: inp("per_page"), totals: true },
          as: "p1",
        }),
        s.set_var("res", ref("p1")),
      ],
      elif: [
        ...SORTS.slice(2).map(([key, sortBy, dir], i) => ({
          when: expr(inp("sort"), "==", c.text(key)),
          then: [
            s.db.query({
              table: products,
              where: productFilters,
              sort: [{ sortBy, dir }],
              paging: { page: inp("page"), per_page: inp("per_page"), totals: true },
              as: `p${i + 2}`,
            }),
            s.set_var("res", ref(`p${i + 2}`)),
          ],
        })),
      ],
      else: [
        s.db.query({
          table: products,
          where: productFilters,
          sort: [{ sortBy: "created_at", dir: "desc" }],
          paging: { page: inp("page"), per_page: inp("per_page"), totals: true },
          as: "p0",
        }),
        s.set_var("res", ref("p0")),
      ],
    }),
  ],
  response: ref("res"),
});

const productDetail = query({
  name: "products/{slug}",
  verb: "GET",
  apiGroup: storeApi,
  input: { slug: input.text({ required: true }) },
  stack: [
    s.db.get({ table: products, fieldName: "slug", fieldValue: inp("slug"), as: "p" }),
    guard.found("p", { message: "Product not found." }),
    s.db.query({ table: productVariants, where: expr(col("product_id"), "=", ref("p.id")), sort: [{ sortBy: "id", dir: "asc" }], as: "variants" }),
    s.db.get({ table: categories, fieldValue: ref("p.category_id"), as: "category" }),
  ],
  response: { product: ref("p"), variants: ref("variants"), category: ref("category") },
});

const productReviews = query({
  name: "products/{slug}/reviews",
  verb: "GET",
  apiGroup: storeApi,
  input: { slug: input.text({ required: true }), page: input.int({ default: 1 }), per_page: input.int({ default: 5 }) },
  stack: [
    s.db.get({ table: products, fieldName: "slug", fieldValue: inp("slug"), as: "p" }),
    guard.found("p", { message: "Product not found." }),
    s.db.query({
      table: reviews,
      where: [expr(col("product_id"), "=", ref("p.id")), expr(col("is_approved"), "=", c.bool(true))],
      sort: [{ sortBy: "created_at", dir: "desc" }],
      paging: { page: inp("page"), per_page: inp("per_page"), totals: true },
      as: "rows",
    }),
  ],
  response: { rating_avg: ref("p.rating_avg"), rating_count: ref("p.rating_count"), reviews: ref("rows") },
});

const home = query({
  name: "home",
  verb: "GET",
  apiGroup: storeApi,
  stack: [
    s.db.query({ table: products, where: [expr(col("is_featured"), "=", c.bool(true)), expr(col("is_available"), "=", c.bool(true))], sort: [{ sortBy: "id", dir: "asc" }], paging: { page: c.int(1), per_page: c.int(8), metadata: false }, as: "featured" }),
    s.db.query({ table: products, where: expr(col("is_available"), "=", c.bool(true)), sort: [{ sortBy: "sales_count", dir: "desc" }], paging: { page: c.int(1), per_page: c.int(4), metadata: false }, as: "best_sellers" }),
    s.db.query({ table: categories, sort: [{ sortBy: "id", dir: "asc" }], as: "categories" }),
  ],
  response: { featured: ref("featured"), best_sellers: ref("best_sellers"), categories: ref("categories") },
});

// ---------- cart ----------

const cartQuote = query({
  name: "cart/quote",
  verb: "POST",
  apiGroup: storeApi,
  input: { items: itemsInput, delivery_type: input.text({ default: "pickup" }), coupon_code: input.text({ default: "" }) },
  stack: [
    s.function.run({ fn: priceCart, input: { items: inp("items"), delivery_type: inp("delivery_type"), coupon_code: inp("coupon_code") }, as: "priced" }),
  ],
  response: ref("priced"),
});

const applyCoupon = query({
  name: "cart/coupon",
  verb: "POST",
  apiGroup: storeApi,
  input: { items: itemsInput, coupon_code: input.text({ required: true }) },
  stack: [
    s.function.run({ fn: priceCart, input: { items: inp("items"), delivery_type: c.text("pickup"), coupon_code: inp("coupon_code") }, as: "priced" }),
    s.precondition({
      expr: expr(ref("priced.coupon.applied"), "==", c.bool(true)),
      error: ref("priced.coupon.message"),
      error_type: "inputerror",
    }),
  ],
  response: ref("priced"),
});

const getCart = query({
  name: "cart",
  verb: "GET",
  apiGroup: storeApi,
  auth: users,
  stack: [
    s.db.query({ table: carts, where: expr(col("user_id"), "=", auth("id")), returnType: "single", as: "cart" }),
    s.set_var("items", c.array([])),
    s.set_var("coupon_code", c.text("")),
    s.conditional({
      when: expr(ref("cart"), "!=", c.null()),
      then: [
        s.set_var("coupon_code", ref("cart.coupon_code", { safe: true })),
        s.db.query({ table: cartItems, where: expr(col("cart_id"), "=", ref("cart.id", { safe: true })), sort: [{ sortBy: "id", dir: "asc" }], as: "rows" }),
        s.array.map({ source: ref("rows"), transform: { product_id: ref("$this.product_id"), variant_id: ref("$this.variant_id"), quantity: ref("$this.quantity") }, as: "mapped" }),
        s.set_var("items", ref("mapped")),
      ],
    }),
  ],
  response: { items: ref("items"), coupon_code: ref("coupon_code") },
});

const saveCart = query({
  name: "cart",
  verb: "PUT",
  apiGroup: storeApi,
  auth: users,
  input: { items: itemsInput, coupon_code: input.text({ nullable: true }) },
  stack: [
    s.db.query({ table: carts, where: expr(col("user_id"), "=", auth("id")), returnType: "single", as: "cart" }),
    s.conditional({
      when: expr(ref("cart"), "==", c.null()),
      then: [s.db.add({ table: carts, row: { user_id: auth("id"), coupon_code: withFilters(inp("coupon_code"), fl.first_notempty("")) }, as: "created" }), s.set_var("cart", ref("created"))],
      else: [s.db.edit({ table: carts, fieldValue: ref("cart.id"), row: { coupon_code: withFilters(inp("coupon_code"), fl.first_notempty("")) } })],
    }),
    s.db.query({ table: cartItems, where: expr(col("cart_id"), "=", ref("cart.id", { safe: true })), as: "old" }),
    s.foreach({ as: "o", list: ref("old"), body: [s.db.del({ table: cartItems, fieldValue: ref("o.id") })] }),
    s.foreach({
      as: "it",
      list: inp("items"),
      body: [
        s.conditional({
          when: expr(ref("it.quantity"), ">", c.int(0)),
          then: [s.db.add({ table: cartItems, row: { cart_id: ref("cart.id", { safe: true }), product_id: ref("it.product_id"), variant_id: ref("it.variant_id"), quantity: ref("it.quantity") } })],
        }),
      ],
    }),
  ],
  response: { saved: c.bool(true) },
});

// ---------- checkout & payment ----------

const checkout = query({
  name: "checkout",
  verb: "POST",
  apiGroup: storeApi,
  auth: users,
  input: {
    items: itemsInput,
    coupon_code: input.text({ default: "" }),
    delivery_type: input.enum(["pickup", "delivery"], { default: "pickup" }),
    delivery_date: input.text({ required: true }),
    delivery_slot: input.text({ required: true }),
    address_id: input.int({ default: 0 }),
    notes: input.text({ default: "" }),
    origin: input.text({ default: "" }),
  },
  stack: [
    s.function.run({ fn: priceCart, input: { items: inp("items"), delivery_type: inp("delivery_type"), coupon_code: inp("coupon_code") }, as: "priced" }),
    s.precondition({ expr: expr(ref("priced.ok"), "==", c.bool(true)), error: ref("priced.message"), error_type: "inputerror" }),
    s.set_var("address", c.null()),
    s.conditional({
      when: expr(inp("address_id"), ">", c.int(0)),
      then: [
        s.db.query({ table: addresses, where: [expr(col("id"), "=", inp("address_id")), expr(col("user_id"), "=", auth("id"))], returnType: "single", as: "found_address" }),
        s.set_var("address", ref("found_address")),
      ],
    }),
    s.lambda({ as: "v", code: lam.file("../lambdas/checkout_validate.ts") }),
    s.precondition({ expr: expr(ref("v.ok"), "==", c.bool(true)), error: ref("v.error"), error_type: "inputerror" }),
    s.db.add({
      table: orders,
      row: {
        user_id: auth("id"),
        order_number: ref("v.order_number"),
        status: "pending",
        subtotal: ref("priced.subtotal"),
        tax: ref("priced.tax"),
        delivery_fee: ref("priced.delivery_fee"),
        discount: ref("priced.discount"),
        total: ref("priced.total"),
        coupon_code: withFilters(ref("priced.coupon.code"), fl.trim()),
        delivery_type: inp("delivery_type"),
        delivery_date: ref("v.delivery_date"),
        delivery_slot: inp("delivery_slot"),
        address_id: inp("address_id"),
        address_text: ref("v.address_text"),
        notes: inp("notes"),
      },
      as: "order",
    }),
    s.foreach({
      as: "l",
      list: ref("priced.lines"),
      body: [
        s.db.add({
          table: orderItems,
          row: {
            order_id: ref("order.id"),
            product_id: ref("l.product_id"),
            variant_id: ref("l.variant_id"),
            name_snapshot: ref("l.display_name"),
            unit_price: ref("l.unit_price"),
            quantity: ref("l.quantity"),
            line_total: ref("l.line_total"),
          },
        }),
      ],
    }),
    s.set_var("mode", c.text("demo")),
    s.conditional({ when: cond.notEmpty(env("STRIPE_SECRET_KEY")), then: [s.set_var("mode", c.text("stripe"))] }),
    s.db.add({
      table: payments,
      row: { order_id: ref("order.id"), provider: ref("mode"), amount: ref("priced.total"), status: "initiated" },
      as: "payment",
    }),
    s.set_var("payment_url", c.text("")),
    s.conditional({
      when: expr(ref("mode"), "==", c.text("stripe")),
      then: [
        s.db.get({ table: users, fieldValue: auth("id"), output: ["id", "email"], as: "buyer" }),
        s.set_var(
          "req",
          obj({ op: c.text("checkout"), order_id: ref("order.id"), order_number: ref("order.order_number"), total: ref("order.total"), email: ref("buyer.email", { safe: true }), origin: inp("origin") }),
        ),
        s.lambda({ as: "st", code: lam.file("../lambdas/stripe_call.ts") }),
        s.conditional({
          when: expr(ref("st.ok", { safe: true }), "!=", c.bool(true)),
          then: [
            s.function.run({ fn: failPayment, input: { order_id: ref("order.id") }, as: "failed" }),
            s.precondition({ expr: expr(c.bool(false), "==", c.bool(true)), error: c.text("We could not start the payment. Please try again."), error_type: "badrequest" }),
          ],
        }),
        s.db.edit({ table: payments, fieldValue: ref("payment.id"), row: { provider_ref: ref("st.id") } }),
        s.set_var("payment_url", ref("st.url")),
      ],
    }),
  ],
  response: {
    order_id: ref("order.id"),
    order_number: ref("order.order_number"),
    total: ref("order.total"),
    mode: ref("mode"),
    payment_url: ref("payment_url"),
  },
});

const demoPayment = query({
  name: "payments/demo",
  verb: "POST",
  apiGroup: storeApi,
  auth: users,
  input: { order_number: input.text({ required: true }), outcome: input.enum(["succeeded", "failed"], { required: true }) },
  stack: [
    s.precondition({
      expr: cond.empty(env("STRIPE_SECRET_KEY")),
      error: c.text("Demo payments are disabled when Stripe is configured."),
      error_type: "accessdenied",
    }),
    s.db.get({ table: orders, fieldName: "order_number", fieldValue: inp("order_number"), as: "order" }),
    ...guard.owner("order", "user_id"),
    s.conditional({
      when: expr(inp("outcome"), "==", c.text("succeeded")),
      then: [s.function.run({ fn: fulfillPayment, input: { order_id: ref("order.id"), provider_ref: c.text("demo_payment") }, as: "r" })],
      else: [s.function.run({ fn: failPayment, input: { order_id: ref("order.id") }, as: "r2" })],
    }),
    s.db.get({ table: orders, fieldValue: ref("order.id"), output: ["id", "order_number", "status", "total"], as: "after" }),
  ],
  response: ref("after"),
});

const stripeWebhook = query({
  name: "webhooks/stripe",
  verb: "POST",
  apiGroup: storeApi,
  stack: [
    s.util.get_raw_input({ encoding: "none", as: "raw" }),
    s.set_var("sig", withFilters(sys.httpHeaders(), fl.get("Stripe-Signature", ""))),
    s.lambda({ as: "ev", code: lam.file("../lambdas/stripe_event.ts") }),
    s.precondition({ expr: expr(ref("ev.ok"), "==", c.bool(true)), error: ref("ev.error"), error_type: "unauthorized" }),
    s.conditional({
      when: expr(ref("ev.type"), "==", c.text("checkout.session.completed")),
      then: [s.function.run({ fn: fulfillPayment, input: { order_id: ref("ev.order_id"), provider_ref: ref("ev.payment_intent") }, as: "done" })],
      elif: [
        {
          when: expr(ref("ev.type"), "==", c.text("checkout.session.expired")),
          then: [s.function.run({ fn: failPayment, input: { order_id: ref("ev.order_id") }, as: "failed1" })],
        },
        {
          when: expr(ref("ev.type"), "==", c.text("payment_intent.payment_failed")),
          then: [s.function.run({ fn: failPayment, input: { order_id: ref("ev.order_id") }, as: "failed2" })],
        },
      ],
    }),
  ],
  response: { received: c.bool(true) },
});

// ---------- orders ----------

const listOrders = query({
  name: "orders",
  verb: "GET",
  apiGroup: storeApi,
  auth: users,
  input: { page: input.int({ default: 1 }), per_page: input.int({ default: 10 }) },
  stack: [
    s.db.query({
      table: orders,
      where: expr(col("user_id"), "=", auth("id")),
      sort: [{ sortBy: "created_at", dir: "desc" }],
      paging: { page: inp("page"), per_page: inp("per_page"), totals: true },
      as: "rows",
    }),
  ],
  response: ref("rows"),
});

const orderDetail = query({
  name: "orders/{order_number}",
  verb: "GET",
  apiGroup: storeApi,
  auth: users,
  input: { order_number: input.text({ required: true }) },
  stack: [
    s.db.get({ table: orders, fieldName: "order_number", fieldValue: inp("order_number"), as: "order" }),
    ...guard.owner("order", "user_id"),
    s.db.query({ table: orderItems, where: expr(col("order_id"), "=", ref("order.id")), sort: [{ sortBy: "id", dir: "asc" }], as: "items" }),
    s.db.query({ table: payments, where: expr(col("order_id"), "=", ref("order.id")), returnType: "single", as: "payment" }),
  ],
  response: { order: ref("order"), items: ref("items"), payment: ref("payment") },
});

// ---------- reviews ----------

const eligibility = query({
  name: "reviews/eligibility",
  verb: "GET",
  apiGroup: storeApi,
  auth: users,
  input: { product_id: input.int({ required: true }) },
  stack: [s.function.run({ fn: reviewEligibility, input: { user_id: auth("id"), product_id: inp("product_id") }, as: "e" })],
  response: ref("e"),
});

const createReview = query({
  name: "reviews",
  verb: "POST",
  apiGroup: storeApi,
  auth: users,
  input: {
    product_id: input.int({ required: true }),
    rating: input.int({ required: true }),
    title: input.text({ default: "" }),
    body: input.text({ default: "" }),
  },
  stack: [
    s.precondition({ expr: expr(inp("rating"), ">=", c.int(1)), error: c.text("Rating must be between 1 and 5."), error_type: "inputerror" }),
    s.precondition({ expr: expr(inp("rating"), "<=", c.int(5)), error: c.text("Rating must be between 1 and 5."), error_type: "inputerror" }),
    s.function.run({ fn: reviewEligibility, input: { user_id: auth("id"), product_id: inp("product_id") }, as: "e" }),
    s.precondition({ expr: expr(ref("e.eligible"), "==", c.bool(true)), error: ref("e.reason"), error_type: "accessdenied" }),
    s.db.get({ table: users, fieldValue: auth("id"), output: ["id", "name"], as: "me" }),
    s.db.add({
      table: reviews,
      row: {
        product_id: inp("product_id"),
        user_id: auth("id"),
        author_name: ref("me.name", { safe: true }),
        order_id: ref("e.order_id"),
        rating: inp("rating"),
        title: inp("title"),
        body: inp("body"),
        is_approved: false,
      },
      as: "review",
    }),
  ],
  response: { id: ref("review.id"), message: c.text("Thanks! Your review will appear once the bakery approves it.") },
});

// ---------- addresses ----------

const addressInput = {
  line1: input.text({ required: true }),
  line2: input.text({ nullable: true }),
  city: input.text({ required: true }),
  state: input.text({ required: true }),
  postal_code: input.text({ required: true }),
  is_default: input.bool({ default: false }),
};

const listAddresses = query({
  name: "addresses",
  verb: "GET",
  apiGroup: storeApi,
  auth: users,
  stack: [s.db.query({ table: addresses, where: expr(col("user_id"), "=", auth("id")), sort: [{ sortBy: "id", dir: "asc" }], as: "rows" })],
  response: ref("rows"),
});

const clearDefaults = [
  s.db.query({ table: addresses, where: [expr(col("user_id"), "=", auth("id")), expr(col("is_default"), "=", c.bool(true))], as: "defaults" }),
  s.foreach({ as: "d", list: ref("defaults"), body: [s.db.edit({ table: addresses, fieldValue: ref("d.id"), row: { is_default: false } })] }),
];

const createAddress = query({
  name: "addresses",
  verb: "POST",
  apiGroup: storeApi,
  auth: users,
  input: addressInput,
  stack: [
    s.conditional({ when: expr(inp("is_default"), "==", c.bool(true)), then: clearDefaults }),
    s.db.add({
      table: addresses,
      row: { user_id: auth("id"), line1: inp("line1"), line2: withFilters(inp("line2"), fl.first_notempty("")), city: inp("city"), state: inp("state"), postal_code: inp("postal_code"), is_default: inp("is_default") },
      as: "address",
    }),
  ],
  response: ref("address"),
});

const updateAddress = query({
  name: "addresses/{id}",
  verb: "PUT",
  apiGroup: storeApi,
  auth: users,
  input: { id: input.int({ required: true }), ...addressInput },
  stack: [
    s.db.get({ table: addresses, fieldValue: inp("id"), as: "found" }),
    ...guard.owner("found", "user_id"),
    s.conditional({ when: expr(inp("is_default"), "==", c.bool(true)), then: clearDefaults }),
    s.db.edit({
      table: addresses,
      fieldValue: inp("id"),
      row: { line1: inp("line1"), line2: withFilters(inp("line2"), fl.first_notempty("")), city: inp("city"), state: inp("state"), postal_code: inp("postal_code"), is_default: inp("is_default") },
      as: "address",
    }),
  ],
  response: ref("address"),
});

const deleteAddress = query({
  name: "addresses/{id}",
  verb: "DELETE",
  apiGroup: storeApi,
  auth: users,
  input: { id: input.int({ required: true }) },
  stack: [
    s.db.get({ table: addresses, fieldValue: inp("id"), as: "found" }),
    ...guard.owner("found", "user_id"),
    s.db.del({ table: addresses, fieldValue: inp("id") }),
  ],
  response: { deleted: c.bool(true) },
});

export const storeQueries = [
  signup, login, forgotPassword, resetPassword, me, updateProfile, storeConfig, listCategories, listProducts, productDetail, productReviews, home,
  cartQuote, applyCoupon, getCart, saveCart, checkout, demoPayment, stripeWebhook, listOrders, orderDetail,
  eligibility, createReview, listAddresses, createAddress, updateAddress, deleteAddress,
];
