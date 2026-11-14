type Any = any;

// Builds the whole dashboard payload from rows the stack fetched.
export default function ({ $var }: { $var: Any }) {
  const range = $var.range;
  const TZ = range.tz as string;
  const REVENUE = ["paid", "preparing", "out_for_delivery", "delivered"];
  const STATUSES = ["pending", "paid", "preparing", "out_for_delivery", "delivered", "cancelled", "refunded"];
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const num = (v: Any) => Number(v) || 0;

  const orders: Any[] = $var.orders || [];
  const items: Any[] = $var.items || [];
  const products = new Map<number, Any>(($var.products || []).map((p: Any) => [num(p.id), p]));
  const categories = new Map<number, Any>(($var.categories || []).map((c: Any) => [num(c.id), c]));
  const users = new Map<number, Any>(($var.users || []).map((u: Any) => [num(u.id), u]));

  const inWindow = (o: Any, a: number, b: number) => num(o.created_at) >= a && num(o.created_at) < b;
  const cur = orders.filter((o) => inWindow(o, range.start, range.cmp_end));
  const prev = orders.filter((o) => inWindow(o, range.prev_start, range.prev_cmp_end));
  const curFull = orders.filter((o) => inWindow(o, range.start, range.end));
  const prevFull = orders.filter((o) => inWindow(o, range.prev_start, range.prev_end));

  const itemsByOrder = new Map<number, Any[]>();
  for (const it of items) {
    const k = num(it.order_id);
    if (!itemsByOrder.has(k)) itemsByOrder.set(k, []);
    itemsByOrder.get(k)!.push(it);
  }
  const isRev = (o: Any) => REVENUE.includes(o.status);

  const metrics = (list: Any[], newCustomers: number) => {
    const rev = list.filter(isRev);
    const revenue = r2(rev.reduce((s, o) => s + num(o.total), 0));
    const sold = rev.reduce((s, o) => s + (itemsByOrder.get(num(o.id)) || []).reduce((q, it) => q + num(it.quantity), 0), 0);
    return {
      revenue,
      orders: rev.length,
      aov: rev.length ? r2(revenue / rev.length) : 0,
      new_customers: newCustomers,
      items_sold: sold,
      cancelled_refunded: list.filter((o) => o.status === "cancelled" || o.status === "refunded").length,
    };
  };
  const newCust = (a: number, b: number) =>
    ($var.users || []).filter((u: Any) => u.role === "customer" && num(u.created_at) >= a && num(u.created_at) < b).length;
  const m1 = metrics(cur, newCust(range.start, range.cmp_end));
  const m0 = metrics(prev, newCust(range.prev_start, range.prev_cmp_end));
  const change = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : null) : Math.round(((a - b) / b) * 1000) / 10);
  const kpi = (k: keyof typeof m1) => ({ value: m1[k], previous: m0[k], change_pct: change(m1[k], m0[k]) });
  const kpis = {
    revenue: kpi("revenue"),
    orders: kpi("orders"),
    avg_order_value: kpi("aov"),
    new_customers: kpi("new_customers"),
    items_sold: kpi("items_sold"),
    cancelled_refunded: kpi("cancelled_refunded"),
  };

  // revenue over time
  const startDT = DateTime.fromMillis(range.start, { zone: TZ });
  const prevStartDT = DateTime.fromMillis(range.prev_start, { zone: TZ });
  const endDT = DateTime.fromMillis(range.end, { zone: TZ });
  const bucket = range.bucket as string;
  const n =
    bucket === "hour" ? Math.round(endDT.diff(startDT, "hours").hours)
    : bucket === "day" ? Math.round(endDT.diff(startDT, "days").days)
    : Math.max(1, Math.round(endDT.diff(startDT, "months").months));
  const idx = (ms: number, base: Any) => {
    const d = DateTime.fromMillis(ms, { zone: TZ });
    if (bucket === "hour") return Math.floor(d.diff(base, "hours").hours);
    if (bucket === "day") return Math.round(d.startOf("day").diff(base.startOf("day"), "days").days);
    return (d.year - base.year) * 12 + (d.month - base.month);
  };
  const label = (i: number) => {
    const d = bucket === "hour" ? startDT.plus({ hours: i }) : bucket === "day" ? startDT.plus({ days: i }) : startDT.plus({ months: i });
    return bucket === "hour" ? d.toFormat("ha").toLowerCase() : bucket === "day" ? d.toFormat("MMM d") : d.toFormat("MMM yyyy");
  };
  const series = Array.from({ length: n }, (_, i) => ({ label: label(i), revenue: 0, previous: 0, orders: 0 }));
  for (const o of curFull.filter(isRev)) {
    const i = idx(num(o.created_at), startDT);
    if (series[i]) {
      series[i].revenue = r2(series[i].revenue + num(o.total));
      series[i].orders += 1;
    }
  }
  for (const o of prevFull.filter(isRev)) {
    const i = idx(num(o.created_at), prevStartDT);
    if (series[i]) series[i].previous = r2(series[i].previous + num(o.total));
  }

  const ordersByStatus = STATUSES.map((status) => ({ status, count: curFull.filter((o) => o.status === status).length }));

  // product and category rollups over revenue orders in the period
  const byProduct = new Map<number, Any>();
  const byCategory = new Map<string, Any>();
  for (const o of curFull.filter(isRev)) {
    for (const it of itemsByOrder.get(num(o.id)) || []) {
      const pid = num(it.product_id);
      const p = products.get(pid);
      const cur = byProduct.get(pid) || { product_id: pid, name: p ? p.name : String(it.name_snapshot).replace(/ \(.*\)$/, ""), revenue: 0, quantity: 0 };
      cur.revenue = r2(cur.revenue + num(it.line_total));
      cur.quantity += num(it.quantity);
      byProduct.set(pid, cur);
      const cat = p && categories.get(num(p.category_id)) ? categories.get(num(p.category_id)).name : "Other";
      const c = byCategory.get(cat) || { category: cat, revenue: 0, quantity: 0 };
      c.revenue = r2(c.revenue + num(it.line_total));
      c.quantity += num(it.quantity);
      byCategory.set(cat, c);
    }
  }
  const productRows = [...byProduct.values()];
  const topByRevenue = [...productRows].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const topByQuantity = [...productRows].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 10);
  const salesByCategory = [...byCategory.values()].sort((a, b) => b.revenue - a.revenue);

  const latestOrders = ($var.latest_orders || []).map((o: Any) => ({
    id: num(o.id),
    order_number: o.order_number,
    status: o.status,
    total: num(o.total),
    created_at: num(o.created_at),
    delivery_type: o.delivery_type,
    customer: users.get(num(o.user_id)) ? users.get(num(o.user_id)).name : "Customer",
  }));
  const lowStock = ($var.low_stock || []).map((p: Any) => ({
    id: num(p.id),
    name: p.name,
    stock_qty: num(p.stock_qty),
    category: categories.get(num(p.category_id)) ? categories.get(num(p.category_id)).name : "",
  }));
  const latestReviews = ($var.latest_reviews || []).map((r: Any) => ({
    id: num(r.id),
    product_name: products.get(num(r.product_id)) ? products.get(num(r.product_id)).name : "Product",
    author_name: r.author_name,
    rating: num(r.rating),
    title: r.title,
    body: r.body,
    is_approved: !!r.is_approved,
    created_at: num(r.created_at),
  }));

  return {
    range: {
      period: range.period,
      tz: TZ,
      bucket,
      from: range.from_date,
      to: range.to_date,
      previous_from: range.prev_from_date,
      previous_to: range.prev_to_date,
    },
    kpis,
    revenue_series: series,
    orders_by_status: ordersByStatus,
    sales_by_category: salesByCategory,
    top_products_by_revenue: topByRevenue,
    top_products_by_quantity: topByQuantity,
    latest_orders: latestOrders,
    low_stock: lowStock,
    latest_reviews: latestReviews,
  };
}
