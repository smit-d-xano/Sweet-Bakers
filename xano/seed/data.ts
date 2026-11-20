// Deterministic demo data. Evaluated on every build; order dates are relative to "now"
// so every dashboard period has data.

const DAY = 86_400_000;

function rng(seedValue: number) {
  let a = seedValue >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20240607);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
const round2 = (n: number) => Math.round(n * 100) / 100;
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const now = Date.now();

const categories = [
  { id: 1, name: "Cakes", slug: "cakes", description: "Celebration cakes baked fresh to order." },
  { id: 2, name: "Breads", slug: "breads", description: "Slow-fermented loaves and everyday breads." },
  { id: 3, name: "Pastries", slug: "pastries", description: "Flaky, buttery morning pastries." },
  { id: 4, name: "Cookies", slug: "cookies", description: "Soft-baked cookies and delicate macarons." },
];

type P = {
  category_id: number; name: string; description: string; price: number;
  stock_qty: number; is_available: boolean; is_featured: boolean; allergens: string[]; weight_or_size: string;
};
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const prodDefs: P[] = [
  { category_id: 1, name: "Chocolate Truffle Cake", price: 38, stock_qty: 24, is_available: true, is_featured: true, allergens: ["Gluten", "Dairy", "Eggs"], weight_or_size: "1 kg, serves 8", description: "Three layers of dark chocolate sponge filled with silky ganache and finished with cocoa truffle shavings." },
  { category_id: 1, name: "Red Velvet Cake", price: 36, stock_qty: 18, is_available: true, is_featured: true, allergens: ["Gluten", "Dairy", "Eggs"], weight_or_size: "1 kg, serves 8", description: "Velvety cocoa-tinted sponge layered with tangy cream cheese frosting." },
  { category_id: 1, name: "Strawberry Shortcake", price: 34, stock_qty: 9, is_available: true, is_featured: false, allergens: ["Gluten", "Dairy", "Eggs"], weight_or_size: "1 kg, serves 8", description: "Light vanilla sponge, whipped cream and fresh strawberries in every layer." },
  { category_id: 1, name: "Lemon Drizzle Cake", price: 28, stock_qty: 6, is_available: true, is_featured: false, allergens: ["Gluten", "Dairy", "Eggs"], weight_or_size: "800 g, serves 6", description: "Zesty lemon loaf cake soaked in a crisp sugar glaze." },
  { category_id: 2, name: "Sourdough Loaf", price: 8, stock_qty: 40, is_available: true, is_featured: true, allergens: ["Gluten"], weight_or_size: "800 g", description: "Our 48-hour fermented country loaf with a blistered crust and an open, tangy crumb." },
  { category_id: 2, name: "Multigrain Loaf", price: 7.5, stock_qty: 30, is_available: true, is_featured: false, allergens: ["Gluten", "Sesame"], weight_or_size: "700 g", description: "Hearty loaf packed with oats, flax, sunflower and sesame seeds." },
  { category_id: 2, name: "Garlic Rosemary Focaccia", price: 9, stock_qty: 14, is_available: true, is_featured: false, allergens: ["Gluten"], weight_or_size: "500 g", description: "Olive-oil focaccia dimpled and baked with roasted garlic, rosemary and sea salt." },
  { category_id: 2, name: "Cinnamon Raisin Bread", price: 8.5, stock_qty: 5, is_available: true, is_featured: false, allergens: ["Gluten", "Dairy"], weight_or_size: "650 g", description: "Soft enriched bread swirled with cinnamon sugar and plump raisins." },
  { category_id: 3, name: "Butter Croissant", price: 3.75, stock_qty: 60, is_available: true, is_featured: true, allergens: ["Gluten", "Dairy"], weight_or_size: "1 piece, 75 g", description: "Laminated with French butter for a shattering crust and honeycomb crumb." },
  { category_id: 3, name: "Pain au Chocolat", price: 4.25, stock_qty: 45, is_available: true, is_featured: false, allergens: ["Gluten", "Dairy"], weight_or_size: "1 piece, 90 g", description: "Buttery croissant dough wrapped around two bars of dark chocolate." },
  { category_id: 3, name: "Almond Danish", price: 4.5, stock_qty: 0, is_available: true, is_featured: false, allergens: ["Gluten", "Dairy", "Nuts"], weight_or_size: "1 piece, 100 g", description: "Flaky pastry filled with frangipane and topped with toasted almonds." },
  { category_id: 3, name: "Blueberry Muffin", price: 3.5, stock_qty: 35, is_available: true, is_featured: false, allergens: ["Gluten", "Dairy", "Eggs"], weight_or_size: "1 piece, 120 g", description: "Tender vanilla muffin bursting with wild blueberries and a sugar crust." },
  { category_id: 4, name: "Chocolate Chip Cookies", price: 9, stock_qty: 50, is_available: true, is_featured: true, allergens: ["Gluten", "Dairy", "Eggs"], weight_or_size: "Box of 6", description: "Chunky brown-butter cookies with pools of dark chocolate and flaky salt." },
  { category_id: 4, name: "Oatmeal Raisin Cookies", price: 8, stock_qty: 8, is_available: true, is_featured: false, allergens: ["Gluten", "Dairy", "Eggs"], weight_or_size: "Box of 6", description: "Chewy oat cookies with plump raisins and a hint of cinnamon." },
  { category_id: 4, name: "Pink Rose Macarons", price: 14, stock_qty: 20, is_available: true, is_featured: true, allergens: ["Nuts", "Eggs", "Dairy"], weight_or_size: "Box of 6", description: "Delicate almond macarons with a rose-petal buttercream filling." },
];
const products = prodDefs.map((p, i) => ({
  ...p,
  id: i + 1,
  slug: slugify(p.name),
  images: [`/products/${slugify(p.name)}.svg`, `/products/${slugify(p.name)}-2.svg`, `/products/${slugify(p.name)}-3.svg`],
  rating_avg: 0,
  rating_count: 0,
  sales_count: 0,
}));

// [product id, label, price_delta, stock]
const variantDefs: Array<[number, string, number, number]> = [
  [1, "500 g", 0, 12], [1, "1 kg", 18, 8], [1, "1 kg Eggless", 22, 4],
  [2, "500 g", 0, 10], [2, "1 kg", 18, 6], [2, "1 kg Eggless", 22, 2],
  [3, "500 g", 0, 5], [3, "1 kg", 16, 4],
  [13, "Box of 6", 0, 30], [13, "Box of 12", 8, 20],
  [14, "Box of 6", 0, 5], [14, "Box of 12", 7, 3],
  [15, "Box of 6", 0, 12], [15, "Box of 12", 12, 8],
];
const variants = variantDefs.map(([product_id, label, price_delta, stock_qty], i) => ({
  id: i + 1, product_id, label, price_delta, stock_qty,
}));

const users = [
  { created_at: now - 400 * DAY, id: 1, name: "Olivia Baker", email: "admin@sweetbakers.test", password: "Admin123!", phone: "555-0100", role: "admin" },
  { created_at: now - 330 * DAY, id: 2, name: "Emma Johnson", email: "emma@example.com", password: "Customer123!", phone: "555-0102", role: "customer" },
  { created_at: now - 250 * DAY, id: 3, name: "Liam Carter", email: "liam@example.com", password: "Customer123!", phone: "555-0103", role: "customer" },
  { created_at: now - 140 * DAY, id: 4, name: "Sophia Martinez", email: "sophia@example.com", password: "Customer123!", phone: "555-0104", role: "customer" },
  { created_at: now - 45 * DAY, id: 5, name: "Noah Williams", email: "noah@example.com", password: "Customer123!", phone: "555-0105", role: "customer" },
  { created_at: now - 6 * DAY, id: 6, name: "Ava Thompson", email: "ava@example.com", password: "Customer123!", phone: "555-0106", role: "customer" },
];

const addressDefs = [
  [2, "14 Maple Street", "Apt 3B", "Brooklyn", "NY", "11201"],
  [3, "220 Oak Avenue", "", "Brooklyn", "NY", "11215"],
  [4, "9 Willow Lane", "Unit 2", "Queens", "NY", "11101"],
  [5, "75 Cedar Court", "", "Manhattan", "NY", "10001"],
  [6, "31 Birch Road", "Floor 4", "Brooklyn", "NY", "11238"],
  [2, "500 Pine Plaza", "Suite 12", "Manhattan", "NY", "10016"],
] as const;
const addresses = addressDefs.map(([user_id, line1, line2, city, state, postal_code], i) => ({
  id: i + 1, user_id, line1, line2, city, state, postal_code, is_default: i < 5,
}));

const coupons = [
  { id: 1, code: "WELCOME10", type: "percent", value: 10, min_order: 15, valid_from: now - 400 * DAY, valid_to: now + 365 * DAY, usage_limit: 1000, is_active: true },
  { id: 2, code: "SWEET5", type: "flat", value: 5, min_order: 30, valid_from: now - 400 * DAY, valid_to: now + 365 * DAY, usage_limit: 0, is_active: true },
  { id: 3, code: "SUMMER20", type: "percent", value: 20, min_order: 40, valid_from: now - 200 * DAY, valid_to: now - 30 * DAY, usage_limit: 100, is_active: true },
];

const SLOTS = ["09:00 - 12:00", "12:00 - 15:00", "15:00 - 18:00"];
const TAX_RATE = 0.08;

type Item = { product: (typeof products)[number]; variant?: (typeof variants)[number]; qty: number };
const orders: Array<Record<string, unknown>> = [];
const orderItems: Array<Record<string, unknown>> = [];
const payments: Array<Record<string, unknown>> = [];
const orderMeta: Array<{ id: number; user_id: number; status: string; items: Item[]; created_at: number }> = [];

const N_ORDERS = 200;
const customers = [2, 3, 4, 5, 6];
for (let i = 0; i < N_ORDERS; i++) {
  // newer orders are more likely: bias towards the recent end of the 12 months
  const age = Math.floor(Math.pow(rand(), 1.35) * 364) + (i < 6 ? 0 : 1);
  const created_at = now - age * DAY - Math.floor((6 + rand() * 9) * 3_600_000);
  const user_id = pick(customers);
  const lines: Item[] = [];
  const nLines = 1 + Math.floor(rand() * 3);
  const used = new Set<number>();
  for (let l = 0; l < nLines; l++) {
    const product = pick(products);
    if (used.has(product.id)) continue;
    used.add(product.id);
    const pv = variants.filter((v) => v.product_id === product.id);
    lines.push({ product, variant: pv.length ? pick(pv) : undefined, qty: 1 + Math.floor(rand() * 3) });
  }
  let status: string;
  const r = rand();
  if (age > 4) status = r < 0.88 ? "delivered" : r < 0.94 ? "cancelled" : "refunded";
  else status = pick(["pending", "paid", "paid", "preparing", "out_for_delivery", "delivered", "delivered"]);

  const subtotal = round2(lines.reduce((s, it) => s + (it.product.price + (it.variant?.price_delta ?? 0)) * it.qty, 0));
  const coupon = rand() < 0.12 ? coupons[0]! : null;
  const discount = coupon ? round2((subtotal * coupon.value) / 100) : 0;
  const delivery_type = rand() < 0.6 ? "delivery" : "pickup";
  const delivery_fee = delivery_type === "delivery" && subtotal < 50 ? 5 : 0;
  const tax = round2((subtotal - discount) * TAX_RATE);
  const total = round2(subtotal - discount + tax + delivery_fee);
  const addr = addresses.find((a) => a.user_id === user_id) ?? addresses[0]!;
  const id = i + 1;
  const paidLike = !["pending", "cancelled"].includes(status);
  orders.push({
    id,
    created_at,
    user_id,
    order_number: `SB-${String(10000 + id)}`,
    status,
    subtotal, tax, delivery_fee, discount, total,
    coupon_code: coupon?.code ?? "",
    delivery_type,
    delivery_date: isoDate(created_at + (1 + Math.floor(rand() * 3)) * DAY),
    delivery_slot: pick(SLOTS),
    address_id: delivery_type === "delivery" ? addr.id : 0,
    address_text: delivery_type === "delivery" ? `${addr.line1}, ${addr.city}, ${addr.state} ${addr.postal_code}` : "",
    notes: rand() < 0.15 ? "Please add a birthday candle." : "",
    paid_at: paidLike ? created_at + 120_000 : null,
  });
  for (const it of lines) {
    const unit = round2(it.product.price + (it.variant?.price_delta ?? 0));
    orderItems.push({
      order_id: id,
      product_id: it.product.id,
      variant_id: it.variant?.id ?? 0,
      name_snapshot: it.variant ? `${it.product.name} (${it.variant.label})` : it.product.name,
      unit_price: unit,
      quantity: it.qty,
      line_total: round2(unit * it.qty),
    });
  }
  payments.push({
    order_id: id,
    created_at,
    provider: "stripe",
    provider_ref: `pi_seed_${String(id).padStart(5, "0")}`,
    amount: total,
    status: status === "refunded" ? "refunded" : paidLike ? "succeeded" : status === "cancelled" ? "failed" : "initiated",
  });
  orderMeta.push({ id, user_id, status, items: lines, created_at });
}

const reviewTitles: Record<number, string[]> = {
  5: ["Absolutely perfect", "Worth every penny", "Best in town", "Heavenly!"],
  4: ["Really delicious", "Great, will order again", "Lovely treat"],
  3: ["Pretty good", "Decent, a bit pricey"],
  2: ["Not quite what I hoped"],
};
const reviewBodies: Record<number, string[]> = {
  5: ["Fresh, beautifully made and arrived right on time. Everyone at the party loved it.", "Such a rich flavour and the texture was spot on. Already planning my next order.", "You can taste the quality ingredients. Bakery quality at its finest."],
  4: ["Very tasty and well packaged. Would have liked a slightly larger portion.", "Great flavour and lovely presentation. Delivery was smooth.", "Really enjoyed it, my family finished it in one evening."],
  3: ["Good overall, though a little sweeter than I expected.", "Tasty but arrived slightly later than the slot."],
  2: ["It was a bit dry this time. Hoping it was a one-off."],
};
const reviews: Array<Record<string, unknown>> = [];
const seenReview = new Set<string>();
const delivered = orderMeta.filter((o) => o.status === "delivered");
for (const o of delivered) {
  if (reviews.length >= 30) break;
  if (rand() > 0.35) continue;
  const it = pick(o.items);
  const key = `${o.user_id}:${it.product.id}`;
  if (seenReview.has(key)) continue;
  seenReview.add(key);
  const rr = rand();
  const rating = rr < 0.5 ? 5 : rr < 0.82 ? 4 : rr < 0.94 ? 3 : 2;
  reviews.push({
    id: reviews.length + 1,
    created_at: o.created_at + 4 * DAY,
    product_id: it.product.id,
    user_id: o.user_id,
    author_name: users.find((u) => u.id === o.user_id)!.name.replace(/ (\w)\w*$/, " $1."),
    order_id: o.id,
    rating,
    title: pick(reviewTitles[rating]!),
    body: pick(reviewBodies[rating]!),
    is_approved: reviews.length % 6 !== 5,
  });
}

// top up so every product shows at least 4 approved reviews
for (const p of products) {
  let have = reviews.filter((r) => r.product_id === p.id && r.is_approved).length;
  for (const o of delivered) {
    if (have >= 4) break;
    if (!o.items.some((it) => it.product.id === p.id)) continue;
    const key = `${o.user_id}:${p.id}`;
    if (seenReview.has(key)) continue;
    seenReview.add(key);
    const rr = rand();
    const rating = rr < 0.55 ? 5 : rr < 0.9 ? 4 : 3;
    reviews.push({
      id: reviews.length + 1,
      created_at: o.created_at + 4 * DAY,
      product_id: p.id,
      user_id: o.user_id,
      author_name: users.find((u) => u.id === o.user_id)!.name.replace(/ (\w)\w*$/, " $1."),
      order_id: o.id,
      rating,
      title: pick(reviewTitles[rating]!),
      body: pick(reviewBodies[rating]!),
      is_approved: true,
    });
    have++;
  }
}

// roll the aggregates up onto the products
for (const p of products) {
  const mine = reviews.filter((r) => r.product_id === p.id && r.is_approved);
  p.rating_count = mine.length;
  p.rating_avg = mine.length ? round2(mine.reduce((s, r) => s + (r.rating as number), 0) / mine.length) : 0;
  p.sales_count = orderMeta
    .filter((o) => !["pending", "cancelled"].includes(o.status))
    .reduce((s, o) => s + o.items.filter((it) => it.product.id === p.id).reduce((q, it) => q + it.qty, 0), 0);
}

export const seed = { users, addresses, categories, products, variants, orders, orderItems, payments, reviews, coupons };
