type Any = any;

// Verifies a Stripe webhook signature (t=...,v1=...) over the raw body and extracts what we need.
export default function ({ $var, $env }: { $var: Any; $env: Any }) {
  const secret = String($env.STRIPE_WEBHOOK_SECRET || "");
  const bad = (error: string) => ({ ok: false, error, type: "", order_id: 0, payment_intent: "", session_id: "" });
  if (!secret) return bad("Webhook secret is not configured.");
  const raw = typeof $var.raw === "string" ? $var.raw : JSON.stringify($var.raw);
  const header = String($var.sig || "");

  let t = "";
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k && k.trim() === "t") t = (v || "").trim();
    if (k && k.trim() === "v1") sigs.push((v || "").trim());
  }
  if (!t || sigs.length === 0) return bad("Missing signature.");
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return bad("Signature timestamp outside tolerance.");

  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  let match = false;
  for (const s of sigs) {
    if (s.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff === 0) match = true;
  }
  if (!match) return bad("Invalid signature.");

  let event: Any;
  try {
    event = JSON.parse(raw);
  } catch {
    return bad("Invalid payload.");
  }
  const obj = (event && event.data && event.data.object) || {};
  const orderId = Number((obj.metadata && obj.metadata.order_id) || obj.client_reference_id || 0);
  return {
    ok: true,
    error: "",
    type: String(event.type || ""),
    order_id: orderId,
    payment_intent: typeof obj.payment_intent === "string" ? obj.payment_intent : "",
    session_id: String(obj.id || ""),
  };
}
