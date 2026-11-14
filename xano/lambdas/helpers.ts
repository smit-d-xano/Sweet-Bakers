type Any = any;

// Small pure helpers for admin actions, selected with the stack variable `op`.
export default function ({ $var }: { $var: Any }) {
  const TZ = "America/New_York";
  if ($var.op === "rating") {
    const rows = ($var.rows as Any[]) || [];
    const count = rows.length;
    const avg = count ? Math.round((rows.reduce((s, r) => s + Number(r.rating), 0) / count) * 100) / 100 : 0;
    return { avg, count };
  }
  if ($var.op === "transition") {
    const next: Record<string, string[]> = {
      pending: ["cancelled"],
      paid: ["preparing", "cancelled"],
      preparing: ["out_for_delivery", "delivered", "cancelled"],
      out_for_delivery: ["delivered"],
      delivered: [],
      cancelled: [],
      refunded: [],
    };
    const allowed = next[String($var.current)] || [];
    const ok = allowed.includes(String($var.next));
    return { ok, error: ok ? "" : `An order that is ${String($var.current).replace(/_/g, " ")} cannot become ${String($var.next).replace(/_/g, " ")}.` };
  }
  if ($var.op === "range") {
    const from = $var.from ? DateTime.fromISO(String($var.from), { zone: TZ }).startOf("day").toMillis() : 0;
    const to = $var.to ? DateTime.fromISO(String($var.to), { zone: TZ }).endOf("day").toMillis() : 0;
    return { from_ms: from || 0, to_ms: to || 0 };
  }
  if ($var.op === "stock") {
    const qty = Math.max(Number($var.it.quantity) || 0, 0);
    const p = $var.p;
    const v = $var.v;
    return {
      stock: p ? Math.max((Number(p.stock_qty) || 0) - qty, 0) : 0,
      sales: p ? (Number(p.sales_count) || 0) + qty : 0,
      vstock: v ? Math.max((Number(v.stock_qty) || 0) - qty, 0) : 0,
    };
  }
  if ($var.op === "restock") {
    const qty = Math.max(Number($var.it.quantity) || 0, 0);
    return {
      stock: $var.p ? (Number($var.p.stock_qty) || 0) + qty : 0,
      vstock: $var.v ? (Number($var.v.stock_qty) || 0) + qty : 0,
    };
  }
  if ($var.op === "slug") {
    const slug = String($var.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return { slug: slug || "item" };
  }
  if ($var.op === "email") {
    const o = $var.order;
    const lines = ($var.items as Any[]).map((i) => `<li>${i.quantity} &times; ${i.name_snapshot} &mdash; $${Number(i.line_total).toFixed(2)}</li>`).join("");
    const when = o.delivery_type === "delivery" ? `Delivery on ${o.delivery_date} (${o.delivery_slot})<br>${o.address_text}` : `Pickup on ${o.delivery_date} (${o.delivery_slot})`;
    return {
      subject: `Your SweetBakers order ${o.order_number} is confirmed`,
      message: `<h2>Thank you, ${$var.user.name}!</h2><p>We received your payment for order <strong>${o.order_number}</strong>.</p><ul>${lines}</ul><p>Subtotal $${Number(o.subtotal).toFixed(2)}<br>Discount -$${Number(o.discount).toFixed(2)}<br>Tax $${Number(o.tax).toFixed(2)}<br>Delivery $${Number(o.delivery_fee).toFixed(2)}<br><strong>Total $${Number(o.total).toFixed(2)}</strong></p><p>${when}</p><p>With love, SweetBakers</p>`,
    };
  }
  return {};
}
