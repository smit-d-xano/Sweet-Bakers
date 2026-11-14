// The one contract with the backend: paths come from xano/routes.gen.ts
// (generated from the query defs), so a renamed endpoint is a compile error.
import { routePath, type RouteName } from "../../../xano/routes.gen.js";

declare global {
  interface Window {
    XANO_HOST?: string;
  }
}

/** The deployed Xano backend's base URL (`window.XANO_HOST` once deployed, `VITE_XANO_HOST` in dev). */
export const XANO_HOST: string =
  (typeof window !== "undefined" && window.XANO_HOST) || import.meta.env.VITE_XANO_HOST || "";

// ---------- types ----------

export type Role = "customer" | "admin";
export interface User { id: number; name: string; email: string; phone: string; role: Role; created_at: number }
export interface Category { id: number; name: string; slug: string; description: string }
export interface Product {
  id: number; category_id: number; name: string; slug: string; description: string; price: number;
  images: string[]; stock_qty: number; is_available: boolean; is_featured: boolean; allergens: string[];
  weight_or_size: string; rating_avg: number; rating_count: number; sales_count: number; created_at: number;
}
export interface Variant { id: number; product_id: number; label: string; price_delta: number; stock_qty: number }
export interface Page<T> { items: T[]; itemsTotal: number; curPage: number; nextPage: number | null; prevPage: number | null; pageTotal: number }
export interface Review {
  id: number; product_id: number; user_id: number; author_name: string; rating: number; title: string; body: string;
  is_approved: boolean; created_at: number; product_name?: string;
}
export interface CartItemInput { product_id: number; variant_id: number; quantity: number }
export interface QuoteLine {
  product_id: number; variant_id: number; quantity: number; unit_price: number; line_total: number;
  display_name: string; issue: string; image?: string; slug?: string; stock_available?: number; name?: string; variant_label?: string;
}
export interface Quote {
  ok: boolean; message: string; lines: QuoteLine[]; issues: string[]; subtotal: number; discount: number; tax: number;
  delivery_fee: number; total: number; item_count: number; tax_rate: number; free_delivery_over: number;
  coupon: { code: string; applied: boolean; valid: boolean; message: string; type: string; value: number };
}
export type OrderStatus = "pending" | "paid" | "preparing" | "out_for_delivery" | "delivered" | "cancelled" | "refunded";
export interface Order {
  id: number; user_id: number; order_number: string; status: OrderStatus; subtotal: number; tax: number;
  delivery_fee: number; discount: number; total: number; coupon_code: string; delivery_type: "pickup" | "delivery";
  delivery_date: string; delivery_slot: string; address_text: string; notes: string; created_at: number;
  customer_name?: string;
}
export interface OrderItem { id: number; product_id: number; variant_id: number; name_snapshot: string; unit_price: number; quantity: number; line_total: number }
export interface Payment { id: number; provider: string; provider_ref: string; amount: number; status: string }
export interface Address { id: number; line1: string; line2: string; city: string; state: string; postal_code: string; is_default: boolean }
export interface Coupon {
  id: number; code: string; type: "percent" | "flat"; value: number; min_order: number; valid_from: number | null;
  valid_to: number | null; usage_limit: number; used_count?: number; is_active: boolean;
}
export interface StoreConfig {
  name: string; timezone: string; tax_rate: number; delivery_fee: number; free_delivery_over: number;
  low_stock_threshold: number; slots: string[]; payment_mode: "demo" | "stripe";
}
export interface Metric { value: number; previous: number; change_pct: number | null }
export interface Dashboard {
  range: { period: string; bucket: string; from_date: string; to_date: string; prev_from_date: string; prev_to_date: string };
  kpis: { revenue: Metric; orders: Metric; avg_order_value: Metric; new_customers: Metric; items_sold: Metric; cancelled_refunded: Metric };
  revenue_series: { label: string; revenue: number; previous: number; orders: number }[];
  orders_by_status: { status: string; count: number }[];
  sales_by_category: { name: string; revenue: number; quantity: number }[];
  top_products_by_revenue: { name: string; revenue: number; quantity: number }[];
  top_products_by_quantity: { name: string; revenue: number; quantity: number }[];
  latest_orders: Order[];
  low_stock: Product[];
  latest_reviews: Review[];
}

// ---------- plumbing ----------

const TOKEN_KEY = "sb_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? "";
export const setToken = (t: string) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Params = Record<string, string | number>;
const pathFor = routePath as unknown as (name: string, params?: Params) => string;

async function call<T>(
  name: RouteName,
  opts: { params?: Params; query?: Record<string, unknown>; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const verb = name.split(" ")[0];
  let url = XANO_HOST + pathFor(name, opts.params);
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "" && v !== false) qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(url, { method: verb, headers, body });
  } catch {
    throw new ApiError("Can't reach the bakery server. Check your connection and try again.", 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const raw = data && typeof data === "object" ? (data as { message?: unknown }).message : undefined;
    const msg = raw ? String(raw) : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const imgUrl = (p?: string) => (!p ? "/hero.svg" : /^(https?:)?\/\//.test(p) || p.startsWith("/products/") ? p : XANO_HOST + p);
export const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));
export const fmtDate = (ms: number | string) =>
  new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York" });

// ---------- endpoints ----------

export const api = {
  // auth
  signup: (b: { name: string; email: string; password: string; phone?: string }) => call<{ token: string; user: User }>("POST auth/signup", { body: b }),
  login: (b: { email: string; password: string }) => call<{ token: string; user: User }>("POST auth/login", { body: b }),
  me: () => call<User>("GET auth/me"),
  updateProfile: (b: { name: string; phone: string }) => call<User>("PUT profile", { body: b }),
  // catalogue
  config: () => call<StoreConfig>("GET store/config"),
  home: () => call<{ featured: Product[]; best_sellers: Product[]; categories: Category[] }>("GET home"),
  categories: () => call<Category[]>("GET categories"),
  products: (q: Record<string, unknown>) => call<Page<Product>>("GET products", { query: q }),
  product: (slug: string) => call<{ product: Product; variants: Variant[]; category: Category }>("GET products/{slug}", { params: { slug } }),
  productReviews: (slug: string, page: number) =>
    call<{ rating_avg: number; rating_count: number; reviews: Page<Review> }>("GET products/{slug}/reviews", { params: { slug }, query: { page, per_page: 5 } }),
  // cart
  quote: (b: { items: CartItemInput[]; delivery_type: string; coupon_code: string }) => call<Quote>("POST cart/quote", { body: b }),
  getCart: () => call<{ items: CartItemInput[]; coupon_code: string }>("GET cart"),
  saveCart: (b: { items: CartItemInput[]; coupon_code: string }) => call<{ saved: boolean }>("PUT cart", { body: b }),
  // checkout
  checkout: (b: Record<string, unknown>) =>
    call<{ order_id: number; order_number: string; total: number; mode: "demo" | "stripe"; payment_url: string }>("POST checkout", { body: b }),
  demoPay: (b: { order_number: string; outcome: "succeeded" | "failed" }) => call<{ order_number: string; status: OrderStatus; total: number }>("POST payments/demo", { body: b }),
  orders: (page = 1) => call<Page<Order>>("GET orders", { query: { page } }),
  order: (n: string) => call<{ order: Order; items: OrderItem[]; payment: Payment | null }>("GET orders/{order_number}", { params: { order_number: n } }),
  eligibility: (product_id: number) => call<{ eligible: boolean; reason: string }>("GET reviews/eligibility", { query: { product_id } }),
  createReview: (b: { product_id: number; rating: number; title: string; body: string }) => call<{ id: number; message: string }>("POST reviews", { body: b }),
  addresses: () => call<Address[]>("GET addresses"),
  addAddress: (b: Omit<Address, "id">) => call<Address>("POST addresses", { body: b }),
  updateAddress: (id: number, b: Omit<Address, "id">) => call<Address>("PUT addresses/{id}", { params: { id }, body: b }),
  deleteAddress: (id: number) => call<{ deleted: boolean }>("DELETE addresses/{id}", { params: { id } }),

  // admin
  dashboard: (q: { period: string; from?: string; to?: string }) => call<Dashboard>("GET admin/dashboard/summary", { query: q }),
  adminProducts: (q: Record<string, unknown>) => call<Page<Product>>("GET admin/products", { query: q }),
  adminProduct: (id: number) => call<{ product: Product; variants: Variant[] }>("GET admin/products/{id}", { params: { id } }),
  saveProduct: (id: number | null, b: Record<string, unknown>) =>
    id ? call<Product>("PUT admin/products/{id}", { params: { id }, body: b }) : call<Product>("POST admin/products", { body: b }),
  deleteProduct: (id: number) => call<{ deleted: boolean }>("DELETE admin/products/{id}", { params: { id } }),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return call<{ path: string }>("POST admin/upload", { form });
  },
  addVariant: (id: number, b: { label: string; price_delta: number; stock_qty: number }) => call<Variant>("POST admin/products/{id}/variants", { params: { id }, body: b }),
  updateVariant: (id: number, b: { label: string; price_delta: number; stock_qty: number }) => call<Variant>("PUT admin/variants/{id}", { params: { id }, body: b }),
  deleteVariant: (id: number) => call<{ deleted: boolean }>("DELETE admin/variants/{id}", { params: { id } }),
  saveCategory: (id: number | null, b: { name: string; description: string }) =>
    id ? call<Category>("PUT admin/categories/{id}", { params: { id }, body: b }) : call<Category>("POST admin/categories", { body: b }),
  deleteCategory: (id: number) => call<{ deleted: boolean }>("DELETE admin/categories/{id}", { params: { id } }),
  adminOrders: (q: Record<string, unknown>) => call<Page<Order>>("GET admin/orders", { query: q }),
  adminOrder: (id: number) =>
    call<{ order: Order; items: OrderItem[]; payment: Payment | null; customer: Pick<User, "id" | "name" | "email" | "phone"> }>("GET admin/orders/{id}", { params: { id } }),
  setOrderStatus: (id: number, status: string) => call<Order>("PUT admin/orders/{id}/status", { params: { id }, body: { status } }),
  refundOrder: (id: number) => call<Order>("POST admin/orders/{id}/refund", { params: { id } }),
  adminReviews: (q: Record<string, unknown>) => call<Page<Review>>("GET admin/reviews", { query: q }),
  setReviewApproval: (id: number, approved: boolean) => call<Review>("PUT admin/reviews/{id}/approval", { params: { id }, body: { approved } }),
  deleteReview: (id: number) => call<{ deleted: boolean }>("DELETE admin/reviews/{id}", { params: { id } }),
  coupons: () => call<Coupon[]>("GET admin/coupons"),
  createCoupon: (b: Record<string, unknown>) => call<Coupon>("POST admin/coupons", { body: b }),
  updateCoupon: (id: number, b: Record<string, unknown>) => call<Coupon>("PUT admin/coupons/{id}", { params: { id }, body: b }),
  deleteCoupon: (id: number) => call<{ deleted: boolean }>("DELETE admin/coupons/{id}", { params: { id } }),
};
