import { defineFunction, input, f, s, ref, inp, c, col, expr, cmp, withFilters, fl, env, cond } from "@xano/sdk";
import { lam } from "@xano/sdk/node";
import {
  users, carts, cartItems, products, productVariants, orders, orderItems, payments, reviews, coupons,
} from "./tables.js";

const lambdaFile = (name: string) => lam.file(`./lambdas/${name}.ts`);

// Prices a basket entirely on the server: stock, variants, coupon, tax, delivery.
export const priceCart = defineFunction({
  name: "price_cart",
  input: {
    items: input.list(input.object({ product_id: f.int(), variant_id: f.int(), quantity: f.int() })),
    delivery_type: input.text({ default: "pickup" }),
    coupon_code: input.text({ default: "" }),
  },
  stack: [
    s.array.map({ source: inp("items"), transform: ref("$this.product_id"), as: "pids" }),
    s.array.map({ source: inp("items"), transform: ref("$this.variant_id"), as: "vids" }),
    s.db.query({ table: products, where: cmp(col("id"), "in", ref("pids")), as: "prods" }),
    s.db.query({ table: productVariants, where: cmp(col("id"), "in", ref("vids")), as: "vars" }),
    s.set_var("code", withFilters(inp("coupon_code"), fl.trim(), fl.upper())),
    s.db.query({ table: coupons, where: expr(col("code"), "=", ref("code")), returnType: "single", as: "coupon" }),
    s.db.query({
      table: orders,
      where: [expr(col("coupon_code"), "=", ref("code")), expr(col("status"), "!=", c.text("cancelled"))],
      returnType: "count",
      as: "coupon_uses",
    }),
    s.lambda({ as: "priced", code: lambdaFile("price_cart") }),
  ],
  response: ref("priced"),
});

// Marks a pending order paid, takes stock, clears the cart and emails the customer. Safe to run twice.
export const fulfillPayment = defineFunction({
  name: "fulfill_payment",
  input: { order_id: input.int({ required: true }), provider_ref: input.text({ default: "" }) },
  stack: [
    s.db.get({ table: orders, fieldValue: inp("order_id"), as: "order" }),
    s.set_var("changed", c.bool(false)),
    s.conditional({
      when: expr(ref("order.status", { safe: true }), "==", c.text("pending")),
      then: [
        s.set_var("changed", c.bool(true)),
        s.db.edit({ table: orders, fieldValue: inp("order_id"), row: { status: "paid", paid_at: c.now() } }),
        s.db.query({ table: payments, where: expr(col("order_id"), "=", inp("order_id")), returnType: "single", as: "pay" }),
        s.conditional({
          when: expr(ref("pay"), "!=", c.null()),
          then: [
            s.db.edit({
              table: payments,
              fieldValue: ref("pay.id"),
              row: { status: "succeeded", provider_ref: withFilters(inp("provider_ref"), fl.first_notempty(ref("pay.provider_ref"))) },
            }),
          ],
        }),
        s.db.query({ table: orderItems, where: expr(col("order_id"), "=", inp("order_id")), as: "items" }),
        s.foreach({
          as: "it",
          list: ref("items"),
          body: [
            s.db.get({ table: products, fieldValue: ref("it.product_id"), as: "p" }),
            s.set_var("v", c.null()),
            s.conditional({
              when: expr(ref("it.variant_id"), ">", c.int(0)),
              then: [s.db.get({ table: productVariants, fieldValue: ref("it.variant_id"), as: "vrow" }), s.set_var("v", ref("vrow"))],
            }),
            s.set_var("op", c.text("stock")),
            s.lambda({ as: "m", code: lambdaFile("helpers") }),
            s.conditional({
              when: expr(ref("p"), "!=", c.null()),
              then: [s.db.edit({ table: products, fieldValue: ref("it.product_id"), row: { stock_qty: ref("m.stock"), sales_count: ref("m.sales") } })],
            }),
            s.conditional({
              when: expr(ref("v"), "!=", c.null()),
              then: [s.db.edit({ table: productVariants, fieldValue: ref("it.variant_id"), row: { stock_qty: ref("m.vstock") } })],
            }),
          ],
        }),
        s.db.query({ table: carts, where: expr(col("user_id"), "=", ref("order.user_id")), returnType: "single", as: "cart" }),
        s.conditional({
          when: expr(ref("cart"), "!=", c.null()),
          then: [
            s.db.query({ table: cartItems, where: expr(col("cart_id"), "=", ref("cart.id")), as: "cart_rows" }),
            s.foreach({ as: "row", list: ref("cart_rows"), body: [s.db.del({ table: cartItems, fieldValue: ref("row.id") })] }),
            s.db.edit({ table: carts, fieldValue: ref("cart.id"), row: { coupon_code: "" } }),
          ],
        }),
        s.conditional({
          when: cond.notEmpty(env("RESEND_API_KEY")),
          then: [
            s.db.get({ table: users, fieldValue: ref("order.user_id"), output: ["id", "name", "email"], as: "user" }),
            s.set_var("op", c.text("email")),
            s.lambda({ as: "mail", code: lambdaFile("helpers") }),
            s.util.send_email({
              service_provider: "resend",
              api_key: env("RESEND_API_KEY"),
              to: ref("user.email", { safe: true }),
              from: c.text("SweetBakers <orders@sweetbakers.example>"),
              subject: ref("mail.subject"),
              message: ref("mail.message"),
              as: "mail_result",
            }),
          ],
        }),
      ],
    }),
  ],
  response: { changed: ref("changed") },
});

// A failed, expired or abandoned payment cancels the pending order but leaves the shopper's cart alone.
export const failPayment = defineFunction({
  name: "fail_payment",
  input: { order_id: input.int({ required: true }) },
  stack: [
    s.db.get({ table: orders, fieldValue: inp("order_id"), as: "order" }),
    s.set_var("changed", c.bool(false)),
    s.conditional({
      when: expr(ref("order.status", { safe: true }), "==", c.text("pending")),
      then: [
        s.set_var("changed", c.bool(true)),
        s.db.edit({ table: orders, fieldValue: inp("order_id"), row: { status: "cancelled" } }),
        s.db.query({ table: payments, where: expr(col("order_id"), "=", inp("order_id")), returnType: "single", as: "pay" }),
        s.conditional({
          when: expr(ref("pay"), "!=", c.null()),
          then: [s.db.edit({ table: payments, fieldValue: ref("pay.id"), row: { status: "failed" } })],
        }),
      ],
    }),
  ],
  response: { changed: ref("changed") },
});

// Recomputes a product's stored rating from its approved reviews.
export const refreshRating = defineFunction({
  name: "refresh_product_rating",
  input: { product_id: input.int({ required: true }) },
  stack: [
    s.db.query({
      table: reviews,
      where: [expr(col("product_id"), "=", inp("product_id")), expr(col("is_approved"), "=", c.bool(true))],
      as: "rows",
    }),
    s.set_var("op", c.text("rating")),
    s.lambda({ as: "r", code: lambdaFile("helpers") }),
    s.db.edit({ table: products, fieldValue: inp("product_id"), row: { rating_avg: ref("r.avg"), rating_count: ref("r.count") } }),
  ],
  response: { avg: ref("r.avg"), count: ref("r.count") },
});

// Puts an order's quantities back on the shelf (used when a paid order is cancelled or refunded).
export const restockOrder = defineFunction({
  name: "restock_order",
  input: { order_id: input.int({ required: true }) },
  stack: [
    s.db.query({ table: orderItems, where: expr(col("order_id"), "=", inp("order_id")), as: "items" }),
    s.foreach({
      as: "it",
      list: ref("items"),
      body: [
        s.db.query({ table: products, where: expr(col("id"), "=", ref("it.product_id")), returnType: "single", as: "p" }),
        s.set_var("v", c.null()),
        s.conditional({
          when: expr(ref("it.variant_id"), ">", c.int(0)),
          then: [
            s.db.query({ table: productVariants, where: expr(col("id"), "=", ref("it.variant_id")), returnType: "single", as: "vrow" }),
            s.set_var("v", ref("vrow")),
          ],
        }),
        s.set_var("op", c.text("restock")),
        s.lambda({ as: "m", code: lambdaFile("helpers") }),
        s.conditional({
          when: expr(ref("p"), "!=", c.null()),
          then: [s.db.edit({ table: products, fieldValue: ref("it.product_id"), row: { stock_qty: ref("m.stock") } })],
        }),
        s.conditional({
          when: expr(ref("v"), "!=", c.null()),
          then: [s.db.edit({ table: productVariants, fieldValue: ref("it.variant_id"), row: { stock_qty: ref("m.vstock") } })],
        }),
      ],
    }),
  ],
  response: { ok: c.bool(true) },
});

// A customer may review a product once, and only after a delivered order that contained it.
export const reviewEligibility = defineFunction({
  name: "review_eligibility",
  input: { user_id: input.int({ required: true }), product_id: input.int({ required: true }) },
  stack: [
    s.set_var("eligible", c.bool(false)),
    s.set_var("order_id", c.int(0)),
    s.set_var("reason", c.text("Only customers with a delivered order for this product can review it.")),
    s.db.query({
      table: orders,
      where: [expr(col("user_id"), "=", inp("user_id")), expr(col("status"), "=", c.text("delivered"))],
      as: "delivered",
    }),
    s.array.map({ source: ref("delivered"), transform: ref("$this.id"), as: "oids" }),
    s.conditional({
      when: expr(withFilters(ref("oids"), fl.count()), ">", c.int(0)),
      then: [
        s.db.query({
          table: orderItems,
          where: [cmp(col("order_id"), "in", ref("oids")), expr(col("product_id"), "=", inp("product_id"))],
          returnType: "single",
          as: "found",
        }),
        s.conditional({
          when: expr(ref("found"), "!=", c.null()),
          then: [
            s.set_var("order_id", ref("found.order_id")),
            s.db.query({
              table: reviews,
              where: [expr(col("user_id"), "=", inp("user_id")), expr(col("product_id"), "=", inp("product_id"))],
              returnType: "exists",
              as: "already",
            }),
            s.conditional({
              when: expr(ref("already"), "==", c.bool(true)),
              then: [s.set_var("reason", c.text("You have already reviewed this product."))],
              else: [s.set_var("eligible", c.bool(true)), s.set_var("reason", c.text(""))],
            }),
          ],
        }),
      ],
    }),
  ],
  response: { eligible: ref("eligible"), order_id: ref("order_id"), reason: ref("reason") },
});

export const allFunctions = [priceCart, fulfillPayment, failPayment, refreshRating, restockOrder, reviewEligibility];
