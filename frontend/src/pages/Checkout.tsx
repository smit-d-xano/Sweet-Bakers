import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, money, type Address } from "@/lib/api";
import { useAsync, useAuth, useCart } from "@/lib/store";
import { EmptyState, ErrorState, Field, Loading } from "@/components/common";
import { Totals, useQuote } from "@/pages/Cart";
import { cn } from "cn";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default function Checkout() {
  const { user, loading: authLoading } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const config = useAsync(() => api.config(), []);
  const addresses = useAsync(() => (user ? api.addresses() : Promise.resolve([] as Address[])), [user?.id]);

  const [type, setType] = useState<"pickup" | "delivery">("pickup");
  const [addressId, setAddressId] = useState(0);
  const [date, setDate] = useState(isoDate(new Date(Date.now() + 86400000)));
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const { quote, error, reload } = useQuote(type);

  if (authLoading) return <Loading rows={3} />;

  if (cart.items.length === 0)
    return (
      <EmptyState
        title="Your cart is empty"
        action={
          <Button asChild>
            <Link to="/products">Browse the bakery</Link>
          </Button>
        }
      />
    );

  if (!user)
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-3xl border bg-card p-8 text-center">
        <h1 className="text-2xl text-primary">Sign in to check out</h1>
        <p className="text-sm text-muted-foreground">Your cart is saved. Sign in or create an account to choose delivery and pay.</p>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link to="/login?next=/checkout">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/signup?next=/checkout">Create account</Link>
          </Button>
        </div>
      </div>
    );

  const slots = config.data?.slots ?? [];
  const chosenAddress = addresses.data?.find((a) => a.id === addressId) ?? addresses.data?.find((a) => a.is_default);
  const effectiveAddress = type === "delivery" ? (addressId || chosenAddress?.id || 0) : 0;

  const place = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (type === "delivery" && !effectiveAddress) return setFormError("Please choose or add a delivery address.");
    if (!slot) return setFormError("Please pick a time slot.");
    setBusy(true);
    try {
      const r = await api.checkout({
        items: cart.items,
        coupon_code: cart.coupon,
        delivery_type: type,
        delivery_date: date,
        delivery_slot: slot,
        address_id: effectiveAddress,
        notes,
        origin: window.location.origin,
      });
      if (r.mode === "stripe" && r.payment_url) window.location.href = r.payment_url;
      else navigate(`/pay/demo/${r.order_number}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not place your order.");
      reload();
    } finally {
      setBusy(false);
    }
  };

  const choice = (active: boolean) =>
    cn("flex-1 rounded-2xl border p-4 text-left transition", active ? "border-primary bg-secondary" : "bg-card hover:bg-accent");

  return (
    <form onSubmit={place} className="space-y-6">
      <h1 className="text-3xl text-primary">Checkout</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="space-y-3 rounded-3xl border bg-card p-5" aria-labelledby="how">
            <h2 id="how" className="text-xl text-primary">
              Pickup or delivery
            </h2>
            <div className="flex gap-3" role="radiogroup" aria-label="Delivery type">
              <button type="button" role="radio" aria-checked={type === "pickup"} className={choice(type === "pickup")} onClick={() => setType("pickup")}>
                <p className="font-medium">Pickup</p>
                <p className="text-sm text-muted-foreground">Free · 12 Maple Street</p>
              </button>
              <button type="button" role="radio" aria-checked={type === "delivery"} className={choice(type === "delivery")} onClick={() => setType("delivery")}>
                <p className="font-medium">Delivery</p>
                <p className="text-sm text-muted-foreground">{config.data ? `${money(config.data.delivery_fee)}, free over ${money(config.data.free_delivery_over)}` : ""}</p>
              </button>
            </div>

            {type === "delivery" && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Delivery address</p>
                {addresses.loading && <Loading rows={1} />}
                {addresses.error && <ErrorState message={addresses.error} onRetry={addresses.reload} />}
                {addresses.data?.map((a) => (
                  <label key={a.id} className={cn("flex cursor-pointer gap-3 rounded-2xl border p-3 text-sm", (addressId || chosenAddress?.id) === a.id && "border-primary bg-secondary")}>
                    <input type="radio" name="address" className="mt-1 accent-primary" checked={(addressId || chosenAddress?.id) === a.id} onChange={() => setAddressId(a.id)} />
                    <span>
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.postal_code}
                      {a.is_default && <span className="ml-2 text-xs text-muted-foreground">(default)</span>}
                    </span>
                  </label>
                ))}
                {addresses.data && addresses.data.length === 0 && <p className="text-sm text-muted-foreground">No saved addresses yet.</p>}
                <AddAddress
                  onAdded={(a) => {
                    setAddressId(a.id);
                    addresses.reload();
                  }}
                />
              </div>
            )}
          </section>

          <section className="grid gap-4 rounded-3xl border bg-card p-5 sm:grid-cols-2" aria-labelledby="when">
            <h2 id="when" className="text-xl text-primary sm:col-span-2">
              {type === "pickup" ? "Pickup" : "Delivery"} date &amp; time
            </h2>
            <Field label="Date" htmlFor="co-date" hint="Orders need at least one day's notice.">
              <Input id="co-date" type="date" required min={isoDate(new Date(Date.now() + 86400000))} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Time slot" htmlFor="co-slot">
              <select
                id="co-slot"
                required
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                className="h-9 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Choose a slot</option>
                {slots.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Order notes (optional)" htmlFor="co-notes">
                <Textarea id="co-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Message for a cake, allergies, gate code…" />
              </Field>
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-3xl border bg-card p-5" aria-label="Order summary">
          <h2 className="text-xl text-primary">Order summary</h2>
          {error && <ErrorState message={error} onRetry={reload} />}
          {!quote && !error && <Loading rows={3} />}
          {quote && (
            <>
              <ul className="space-y-2 text-sm">
                {quote.lines.map((l) => (
                  <li key={`${l.product_id}-${l.variant_id}`} className="flex justify-between gap-2">
                    <span>
                      {l.quantity} × {l.display_name}
                    </span>
                    <span>{money(l.line_total)}</span>
                  </li>
                ))}
              </ul>
              <Totals q={quote} />
              {quote.issues.length > 0 && (
                <ul role="alert" className="space-y-1 text-sm text-destructive">
                  {quote.issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy || !quote?.ok}>
            {busy ? "Placing order…" : config.data?.payment_mode === "stripe" ? "Place order & pay with Stripe" : "Place order & pay"}
          </Button>
          {config.data?.payment_mode === "demo" && <p className="text-xs text-muted-foreground">Stripe isn't connected, so payment runs in demo mode.</p>}
          <Button type="button" variant="link" className="w-full" onClick={() => toast("Your cart is kept until payment succeeds.")}>
            Is my cart safe if payment fails?
          </Button>
        </aside>
      </div>
    </form>
  );
}

function AddAddress({ onAdded }: { onAdded: (a: Address) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ line1: "", line2: "", city: "", state: "", postal_code: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  if (!open)
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add a new address
      </Button>
    );
  return (
    <div className="grid gap-3 rounded-2xl border p-3 sm:grid-cols-2">
      <Field label="Street address" htmlFor="ad-1">
        <Input id="ad-1" value={f.line1} onChange={set("line1")} />
      </Field>
      <Field label="Apartment, suite (optional)" htmlFor="ad-2">
        <Input id="ad-2" value={f.line2} onChange={set("line2")} />
      </Field>
      <Field label="City" htmlFor="ad-3">
        <Input id="ad-3" value={f.city} onChange={set("city")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="State" htmlFor="ad-4">
          <Input id="ad-4" value={f.state} onChange={set("state")} />
        </Field>
        <Field label="ZIP" htmlFor="ad-5">
          <Input id="ad-5" value={f.postal_code} onChange={set("postal_code")} />
        </Field>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || !f.line1 || !f.city || !f.state || !f.postal_code}
          onClick={async () => {
            setBusy(true);
            try {
              onAdded(await api.addAddress({ ...f, is_default: false }));
              setOpen(false);
              setF({ line1: "", line2: "", city: "", state: "", postal_code: "" });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not save the address.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save address
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
