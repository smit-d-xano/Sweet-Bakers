# SweetBakers

An online bakery: customers browse, review and buy; the owner manages products and orders and
tracks sales on a dashboard (daily, weekly, monthly, yearly or a custom range, each compared
with the previous period).

- Backend: TypeScript on [Xano](https://xano.com) in [`xano/`](xano/) (12 tables, 49 endpoints).
- Frontend: React + Vite + Tailwind + shadcn in [`frontend/`](frontend/).

## Setup

```bash
npm install
npm run xano:deploy   # run the backend on the Xano Engine on this machine, seeds sample data
npm run dev           # the storefront, pointed at it
```

`npm run xano:deploy -- --reset` re-seeds the data. Check everything with `npm run xano:check`
and `npm run build`.

## Logins (seed data)

| Role | Email | Password |
| --- | --- | --- |
| Admin / owner | `admin@sweetbakers.test` | `Admin123!` |
| Customers | `emma@`, `liam@`, `sophia@`, `noah@`, `ava@` + `example.com` | `Customer123!` |

The admin panel is at `/admin`. On a local preview, the sign-in page also has a
"Sign in as sample user" button.

Seed data: 4 categories, 15 products, about 200 orders over the last 12 months, about 30
reviews. Coupons: `WELCOME10` (10% off, min $15), `SWEET5` ($5 off, min $30), `SUMMER20` (expired).

## Payments

- **Demo mode (default):** with no Stripe key, checkout creates the order as `pending` and goes
  to a demo payment page. Pay or fail there to exercise the same paid / failed paths.
- **Stripe test mode:** set the secrets, then add a Stripe webhook that points to
  `<backend url>/api:sweetbakers/webhooks/stripe` for `checkout.session.completed`,
  `checkout.session.expired` and `payment_intent.payment_failed`.

  ```bash
  echo -n sk_test_... | npx @xano/sdk env set STRIPE_SECRET_KEY
  echo -n whsec_...   | npx @xano/sdk env set STRIPE_WEBHOOK_SECRET
  echo -n re_...      | npx @xano/sdk env set RESEND_API_KEY   # confirmation emails
  ```

  Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 9995` is declined,
  `4000 0025 0000 3155` asks for 3-D Secure. Any future expiry, any CVC, any ZIP.

An order becomes `paid` and stock is decremented only when the webhook (signature verified)
or the demo payment confirms success. Failed or cancelled payments keep the cart.

## Rules

- Prices, tax (8%), delivery fee ($5, free from $50) and coupons are recalculated on the server.
- Quantity is limited to stock; checkout is blocked when stock changed.
- Only customers with a delivered order can review a product, once; the admin approves reviews first.
- Revenue counts `paid`, `preparing`, `out_for_delivery` and `delivered`. Cancelled and refunded
  orders are counted separately. Days use the bakery timezone (America/New_York).
- Product photos are generated placeholders (`node scripts/gen-images.mjs`); upload real ones in
  the admin panel.

<!-- BEGIN:xanosdk-built-with -->
<!-- xanosdk 1.0.21 — generated; edits inside this block are overwritten -->

## Built with

- [Xano](https://xano.com) hosts everything under [`xano/`](xano/): the database, APIs,
  auth, background tasks, realtime, file storage and AI agents. It runs on your machine as
  the Xano Engine and in the cloud from the same command. [Docs](https://docs.xano.com) ·
  [Community](https://community.xano.com)
- [Xano SDK](https://github.com/xano-sdk/sdk) is the TypeScript the backend is authored in.
  The [guides](https://github.com/xano-sdk/sdk/blob/main/guides/README.md) cover signing in
  and deploying, releasing to production, the typed frontend, and every CLI command.
<!-- END:xanosdk-built-with -->
