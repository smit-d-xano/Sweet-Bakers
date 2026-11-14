import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, imgUrl, money, type Quote } from "@/lib/api";
import { useCart } from "@/lib/store";
import { EmptyState, ErrorState, Loading } from "@/components/common";

export function useQuote(deliveryType: "pickup" | "delivery") {
  const cart = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(cart.items) + cart.coupon + deliveryType + tick;

  useEffect(() => {
    if (cart.items.length === 0) {
      setQuote(null);
      return;
    }
    let live = true;
    setLoading(true);
    api
      .quote({ items: cart.items, delivery_type: deliveryType, coupon_code: cart.coupon })
      .then((q) => live && (setQuote(q), setError("")))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "Could not price your cart."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { quote, error, loading, reload: () => setTick((t) => t + 1) };
}

export function Totals({ q }: { q: Quote }) {
  const row = (label: string, value: string, strong = false) => (
    <div className={strong ? "flex justify-between border-t pt-3 text-lg font-semibold text-primary" : "flex justify-between text-sm"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <dl className="space-y-2">
      {row("Subtotal", money(q.subtotal))}
      {q.discount > 0 && row(`Discount (${q.coupon.code})`, `-${money(q.discount)}`)}
      {row(`Tax (${Math.round(q.tax_rate * 100)}%)`, money(q.tax))}
      {row("Delivery", q.delivery_fee > 0 ? money(q.delivery_fee) : "Free")}
      {row("Total", money(q.total), true)}
    </dl>
  );
}

export default function Cart() {
  const cart = useCart();
  const { quote, error, loading, reload } = useQuote("pickup");
  const [code, setCode] = useState(cart.coupon);

  useEffect(() => setCode(cart.coupon), [cart.coupon]);

  if (cart.items.length === 0)
    return (
      <EmptyState
        title="Your cart is empty"
        hint="Add a few treats and they'll show up here."
        action={
          <Button asChild>
            <Link to="/products">Browse the bakery</Link>
          </Button>
        }
      />
    );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-primary">Your cart</h1>
      {error && <ErrorState message={error} onRetry={reload} />}
      {!quote && loading && <Loading rows={3} />}
      {quote && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <ul className="space-y-3">
            {quote.lines.map((l) => (
              <li key={`${l.product_id}-${l.variant_id}`} className="flex gap-4 rounded-3xl border bg-card p-4">
                <img src={imgUrl(l.image)} alt="" className="size-20 rounded-2xl object-cover sm:size-24" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex justify-between gap-2">
                    <Link to={`/products/${l.slug}`} className="font-medium hover:underline">
                      {l.display_name}
                    </Link>
                    <span className="font-semibold">{money(l.line_total)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{money(l.unit_price)} each</p>
                  {l.issue && (
                    <p role="alert" className="text-sm text-destructive">
                      {l.issue === "low_stock" ? `Only ${l.stock_available} left in stock — please lower the quantity.` : l.issue === "out_of_stock" ? "This item is out of stock." : "This item is no longer available."}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center rounded-full border" role="group" aria-label={`Quantity of ${l.display_name}`}>
                      <Button variant="ghost" size="icon" aria-label="Decrease quantity" disabled={l.quantity <= 1} onClick={() => cart.setQty(l.product_id, l.variant_id, l.quantity - 1)}>
                        <Minus />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{l.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Increase quantity"
                        disabled={l.stock_available !== undefined && l.quantity >= l.stock_available}
                        onClick={() => cart.setQty(l.product_id, l.variant_id, l.quantity + 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => cart.remove(l.product_id, l.variant_id)}>
                      <Trash2 aria-hidden /> Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit space-y-4 rounded-3xl border bg-card p-5" aria-label="Order summary">
            <h2 className="text-xl text-primary">Summary</h2>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                cart.setCoupon(code.trim().toUpperCase());
              }}
            >
              <Input aria-label="Coupon code" placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} />
              <Button type="submit" variant="outline">
                <Tag aria-hidden /> Apply
              </Button>
            </form>
            {quote.coupon.code && (
              <p className={quote.coupon.valid ? "text-sm text-primary" : "text-sm text-destructive"} role="status">
                {quote.coupon.valid ? `Coupon ${quote.coupon.code} applied.` : quote.coupon.message}
                {" "}
                <button className="underline" onClick={() => (cart.setCoupon(""), toast("Coupon removed"))}>
                  Remove
                </button>
              </p>
            )}
            <Totals q={quote} />
            <p className="text-xs text-muted-foreground">Free delivery on orders over {money(quote.free_delivery_over)}. Pickup is always free.</p>
            <Button asChild size="lg" className="w-full" aria-disabled={!quote.ok}>
              <Link to="/checkout" onClick={(e) => !quote.ok && e.preventDefault()}>
                {quote.ok ? "Checkout" : "Fix cart issues to continue"}
              </Link>
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
