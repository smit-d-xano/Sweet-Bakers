type Any = any;

// Talks to Stripe with form-encoded bodies. op = "checkout" | "refund".
export default async function ({ $var, $env }: { $var: Any; $env: Any }) {
  const $input = $var.req;
  try {
    const key = String($env.STRIPE_SECRET_KEY || "").trim();
    if (!key) return { ok: false, error: "Stripe is not configured.", url: "", id: "" };
    const pairs: string[] = [];
    const form = {
      set: (k: string, v: string) => pairs.push(encodeURIComponent(k) + "=" + encodeURIComponent(v)),
      toString: () => pairs.join("&"),
    };
    let url = "https://api.stripe.com/v1/checkout/sessions";
    if ($input.op === "refund") {
      url = "https://api.stripe.com/v1/refunds";
      form.set("payment_intent", String($input.payment_intent));
    } else {
      const origin = String($input.origin || "").replace(/\/+$/, "");
      form.set("mode", "payment");
      form.set("success_url", `${origin}/checkout/success?order=${$input.order_number}`);
      form.set("cancel_url", `${origin}/checkout/cancelled?order=${$input.order_number}`);
      form.set("client_reference_id", String($input.order_id));
      if ($input.email) form.set("customer_email", String($input.email));
      form.set("line_items[0][quantity]", "1");
      form.set("line_items[0][price_data][currency]", "usd");
      form.set("line_items[0][price_data][unit_amount]", String(Math.round(Number($input.total) * 100)));
      form.set("line_items[0][price_data][product_data][name]", `SweetBakers order ${$input.order_number}`);
      form.set("metadata[order_id]", String($input.order_id));
      form.set("metadata[order_number]", String($input.order_number));
      form.set("payment_intent_data[metadata][order_id]", String($input.order_id));
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data: Any = await res.json();
    if (!res.ok) return { ok: false, error: (data && data.error && data.error.message) || "Stripe error.", url: "", id: "" };
    return { ok: true, error: "", url: String(data.url || ""), id: String(data.id || "") };
  } catch (e: Any) {
    return { ok: false, error: String((e && e.message) || e), url: "", id: "" };
  }
}
