import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, CreditCard, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, money } from "@/lib/api";
import { useAsync, useCart } from "@/lib/store";
import { ErrorState, Loading, StatusBadge } from "@/components/common";

// Stripe isn't connected: this page stands in for Stripe's hosted checkout.
export function DemoPay() {
  const { orderNumber = "" } = useParams();
  const navigate = useNavigate();
  const order = useAsync(() => api.order(orderNumber), [orderNumber]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pay = async (outcome: "succeeded" | "failed") => {
    setBusy(true);
    setError("");
    try {
      await api.demoPay({ order_number: orderNumber, outcome });
      navigate(outcome === "succeeded" ? `/checkout/success?order=${orderNumber}` : `/checkout/cancelled?order=${orderNumber}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
      setBusy(false);
    }
  };

  if (order.loading) return <Loading rows={3} />;
  if (order.error || !order.data) return <ErrorState message={order.error || "Order not found."} onRetry={order.reload} />;
  const o = order.data.order;

  return (
    <div className="mx-auto max-w-md space-y-5 rounded-3xl border bg-card p-8">
      <div className="flex items-center gap-2 text-primary">
        <CreditCard aria-hidden />
        <h1 className="text-2xl">Demo payment</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Order <strong>{o.order_number}</strong> · total <strong>{money(o.total)}</strong>. This simulates the payment provider's page when no Stripe key is configured.
      </p>
      {o.status !== "pending" ? (
        <div className="space-y-3">
          <StatusBadge status={o.status} />
          <Button asChild>
            <Link to="/account">View my orders</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl bg-secondary p-3 text-sm">
            Test card <strong>4242 4242 4242 4242</strong> · any future date · any CVC
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button size="lg" className="w-full" disabled={busy} onClick={() => pay("succeeded")}>
            Pay {money(o.total)}
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => pay("failed")}>
            Simulate a declined card
          </Button>
        </div>
      )}
    </div>
  );
}

export function CheckoutResult({ kind }: { kind: "success" | "cancelled" }) {
  const [params] = useSearchParams();
  const number = params.get("order") ?? "";
  const cart = useCart();
  const [tries, setTries] = useState(0);
  const order = useAsync(() => api.order(number), [number, tries]);
  const status = order.data?.order.status;

  // The payment confirmation can arrive a moment after the redirect, so check a few times.
  useEffect(() => {
    if (kind !== "success" || status !== "pending" || tries >= 6) return;
    const t = setTimeout(() => setTries((n) => n + 1), 2000);
    return () => clearTimeout(t);
  }, [kind, status, tries]);

  useEffect(() => {
    if (kind === "success" && status && status !== "pending" && status !== "cancelled") cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, status]);

  if (kind === "cancelled")
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-3xl border bg-card p-8 text-center">
        <XCircle className="mx-auto size-12 text-destructive" aria-hidden />
        <h1 className="text-2xl text-primary">Payment didn't go through</h1>
        <p className="text-sm text-muted-foreground">No charge was made and your cart is exactly as you left it.</p>
        <Button asChild>
          <Link to="/checkout">Try again</Link>
        </Button>
      </div>
    );

  if (order.loading && !order.data) return <Loading rows={3} />;
  if (order.error || !order.data) return <ErrorState message={order.error || "Order not found."} onRetry={order.reload} />;
  const { order: o, items } = order.data;

  return (
    <div className="mx-auto max-w-xl space-y-5 rounded-3xl border bg-card p-8">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" aria-hidden />
        <h1 className="mt-2 text-3xl text-primary">{o.status === "pending" ? "Confirming your payment…" : "Thank you for your order!"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order <strong>{o.order_number}</strong> · <StatusBadge status={o.status} />
        </p>
        {o.status !== "pending" && <p className="text-sm text-muted-foreground">A confirmation email is on its way.</p>}
      </div>
      <ul className="space-y-1 border-y py-3 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between">
            <span>
              {i.quantity} × {i.name_snapshot}
            </span>
            <span>{money(i.line_total)}</span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between text-lg font-semibold text-primary">
        <span>Total</span>
        <span>{money(o.total)}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        {o.delivery_type === "pickup" ? "Pickup" : "Delivery"} on {o.delivery_date}, {o.delivery_slot}
      </p>
      <Button asChild className="w-full">
        <Link to="/account">Track my orders</Link>
      </Button>
    </div>
  );
}
