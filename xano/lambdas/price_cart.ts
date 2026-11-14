type Any = any;

// Prices are always computed here on the server from the database rows.
export default function ({ $input, $var }: { $input: Any; $var: Any }) {
  const TAX_RATE = 0.08;
  const DELIVERY_FEE = 5;
  const FREE_DELIVERY_OVER = 50;
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const prods = new Map<number, Any>((($var.prods as Any[]) || []).map((p) => [Number(p.id), p]));
  const vars = new Map<number, Any>((($var.vars as Any[]) || []).map((v) => [Number(v.id), v]));

  // merge duplicate product+variant lines
  const merged = new Map<string, Any>();
  for (const it of ($input.items as Any[]) || []) {
    const key = `${Number(it.product_id)}:${Number(it.variant_id) || 0}`;
    const qty = Math.floor(Number(it.quantity) || 0);
    const cur = merged.get(key);
    if (cur) cur.quantity += qty;
    else merged.set(key, { product_id: Number(it.product_id), variant_id: Number(it.variant_id) || 0, quantity: qty });
  }

  const issues: string[] = [];
  const lines: Any[] = [];
  for (const it of merged.values()) {
    const p = prods.get(it.product_id);
    if (!p) {
      issues.push("An item in your cart is no longer sold.");
      continue;
    }
    const v = it.variant_id ? vars.get(it.variant_id) : null;
    let issue = "";
    let available = Number(p.stock_qty) || 0;
    if (it.variant_id && (!v || Number(v.product_id) !== it.product_id)) {
      issue = "invalid_variant";
    } else if (v) {
      available = Math.min(available, Number(v.stock_qty) || 0);
    }
    if (!issue && !p.is_available) issue = "unavailable";
    else if (!issue && available <= 0) issue = "out_of_stock";
    else if (!issue && it.quantity < 1) issue = "invalid_quantity";
    else if (!issue && it.quantity > available) issue = "low_stock";

    const label = v ? String(v.label) : "";
    const unit = r2(Number(p.price) + (v ? Number(v.price_delta) || 0 : 0));
    const name = String(p.name) + (label ? ` (${label})` : "");
    if (issue) {
      const msg =
        issue === "low_stock" ? `Only ${available} of "${name}" left in stock.`
        : issue === "out_of_stock" ? `"${name}" is out of stock.`
        : issue === "unavailable" ? `"${name}" is no longer available.`
        : issue === "invalid_variant" ? `The selected option for "${p.name}" is not valid.`
        : `Quantity for "${name}" must be at least 1.`;
      issues.push(msg);
    }
    lines.push({
      product_id: it.product_id,
      variant_id: it.variant_id,
      slug: p.slug,
      name: String(p.name),
      display_name: name,
      variant_label: label,
      image: (p.images && p.images[0]) || "",
      unit_price: unit,
      quantity: it.quantity,
      line_total: r2(unit * Math.max(it.quantity, 0)),
      stock_available: available,
      issue,
    });
  }

  const subtotal = r2(lines.reduce((s, l) => s + l.line_total, 0));

  const code = String($input.coupon_code || "").trim().toUpperCase();
  const coupon: Any = { code, applied: false, valid: !code, message: "", type: "", value: 0 };
  let discount = 0;
  if (code) {
    const c = $var.coupon;
    const now = Date.now();
    if (!c || !c.is_active) coupon.message = "That coupon code is not valid.";
    else if (c.valid_from && now < Number(c.valid_from)) coupon.message = "That coupon is not active yet.";
    else if (c.valid_to && now > Number(c.valid_to)) coupon.message = "That coupon has expired.";
    else if (subtotal < Number(c.min_order || 0)) coupon.message = `Spend at least $${Number(c.min_order).toFixed(2)} to use this coupon.`;
    else if (Number(c.usage_limit) > 0 && Number($var.coupon_uses || 0) >= Number(c.usage_limit)) coupon.message = "That coupon has reached its usage limit.";
    else {
      coupon.valid = true;
      coupon.applied = true;
      coupon.type = c.type;
      coupon.value = Number(c.value);
      coupon.message = c.type === "percent" ? `${Number(c.value)}% off applied.` : `$${Number(c.value).toFixed(2)} off applied.`;
      discount = c.type === "percent" ? r2((subtotal * Number(c.value)) / 100) : Math.min(Number(c.value), subtotal);
    }
  }

  const taxable = Math.max(subtotal - discount, 0);
  const tax = r2(taxable * TAX_RATE);
  const delivery_fee = $input.delivery_type === "delivery" && lines.length > 0 && taxable < FREE_DELIVERY_OVER ? DELIVERY_FEE : 0;
  const total = r2(taxable + tax + delivery_fee);

  const finalIssues = lines.length === 0 && issues.length === 0 ? ["Your cart is empty."] : issues;
  return {
    ok: lines.length > 0 && issues.length === 0 && coupon.valid,
    message: finalIssues.length ? finalIssues.join(" ") : coupon.valid ? "" : coupon.message,
    lines,
    issues: finalIssues,
    subtotal,
    discount,
    tax,
    delivery_fee,
    total,
    coupon,
    item_count: lines.reduce((s, l) => s + Math.max(l.quantity, 0), 0),
    tax_rate: TAX_RATE,
    free_delivery_over: FREE_DELIVERY_OVER,
  };
}
