import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, fmtDate, imgUrl, money } from "@/lib/api";
import { useAsync, useAuth, useCart } from "@/lib/store";
import { EmptyState, ErrorState, Field, Loading, Pager, Stars } from "@/components/common";
import { cn } from "cn";

export default function ProductDetail() {
  const { slug = "" } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.product(slug), [slug]);
  const cart = useCart();
  const [img, setImg] = useState(0);
  const [variantId, setVariantId] = useState(0);
  const [qty, setQty] = useState(1);

  if (loading) return <Loading rows={5} />;
  if (error || !data) return <ErrorState message={error || "Product not found."} onRetry={reload} />;

  const { product: p, variants, category } = data;
  const variant = variants.find((v) => v.id === variantId);
  const available = p.is_available ? (variant ? Math.min(variant.stock_qty, p.stock_qty) || variant.stock_qty : p.stock_qty) : 0;
  const unit = p.price + (variant?.price_delta ?? 0);
  const inCart = cart.items.find((i) => i.product_id === p.id && i.variant_id === variantId)?.quantity ?? 0;
  const maxQty = Math.max(available - inCart, 0);
  const out = available <= 0;
  const q = Math.min(Math.max(qty, 1), Math.max(maxQty, 1));

  return (
    <div className="space-y-12">
      <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/products" className="hover:underline">
          Shop
        </Link>{" "}
        / <Link to={`/products?category_id=${category.id}`} className="hover:underline">{category.name}</Link> / {p.name}
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-3xl border bg-muted">
            <img src={imgUrl(p.images[img])} alt={p.name} className="size-full object-cover" />
          </div>
          {p.images.length > 1 && (
            <div className="flex gap-3">
              {p.images.map((im, i) => (
                <button
                  key={im}
                  onClick={() => setImg(i)}
                  aria-label={`Show photo ${i + 1}`}
                  aria-pressed={i === img}
                  className={cn("size-20 overflow-hidden rounded-2xl border-2", i === img ? "border-primary" : "border-transparent")}
                >
                  <img src={imgUrl(im)} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <h1 className="text-3xl text-primary sm:text-4xl">{p.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <Stars value={p.rating_avg} count={p.rating_count} />
              {p.weight_or_size && <span className="text-sm text-muted-foreground">{p.weight_or_size}</span>}
            </div>
          </div>
          <p className="text-3xl font-semibold text-primary">{money(unit)}</p>
          <p className="text-muted-foreground">{p.description}</p>

          {p.allergens.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Allergens</p>
              <div className="flex flex-wrap gap-2">
                {p.allergens.map((a) => (
                  <Badge key={a} variant="secondary" className="rounded-full">
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {variants.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Choose an option</legend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setVariantId(0)}
                  aria-pressed={variantId === 0}
                  className={cn("rounded-full border px-4 py-1.5 text-sm", variantId === 0 ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
                >
                  Standard
                </button>
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={v.stock_qty <= 0}
                    onClick={() => {
                      setVariantId(v.id);
                      setQty(1);
                    }}
                    aria-pressed={variantId === v.id}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm disabled:opacity-50",
                      variantId === v.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                    )}
                  >
                    {v.label}
                    {v.price_delta ? ` (${v.price_delta > 0 ? "+" : ""}${money(v.price_delta)})` : ""}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {out ? (
            <Badge className="rounded-full bg-foreground px-4 py-1.5 text-background">Out of stock</Badge>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-full border bg-card" role="group" aria-label="Quantity">
                  <Button variant="ghost" size="icon" aria-label="Decrease quantity" disabled={q <= 1} onClick={() => setQty(q - 1)}>
                    <Minus />
                  </Button>
                  <span className="w-8 text-center font-medium" aria-live="polite">
                    {q}
                  </span>
                  <Button variant="ghost" size="icon" aria-label="Increase quantity" disabled={q >= maxQty} onClick={() => setQty(q + 1)}>
                    <Plus />
                  </Button>
                </div>
                <Button
                  size="lg"
                  disabled={maxQty <= 0}
                  onClick={() => {
                    cart.add(p.id, variantId, q);
                    setQty(1);
                    toast.success(`${q} × ${p.name} added to your cart`);
                  }}
                >
                  <ShoppingBag aria-hidden /> Add to cart
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {available <= 10 ? `Only ${available} left. ` : ""}
                {inCart > 0 ? `${inCart} already in your cart.` : ""}
              </p>
            </div>
          )}
        </div>
      </div>

      <Reviews slug={slug} productId={p.id} />
    </div>
  );
}

function Reviews({ slug, productId }: { slug: string; productId: number }) {
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const reviews = useAsync(() => api.productReviews(slug, page), [slug, page]);
  const elig = useAsync(() => (user ? api.eligibility(productId) : Promise.resolve({ eligible: false, reason: "" })), [user?.id, productId]);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.createReview({ product_id: productId, rating, title, body });
      toast.success(r.message);
      setSent(true);
      elig.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your review.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="reviews" className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="reviews" className="text-2xl text-primary">
          Reviews
        </h2>
        {reviews.data && <Stars value={reviews.data.rating_avg} count={reviews.data.rating_count} />}
      </div>

      {reviews.loading && <Loading rows={2} />}
      {reviews.error && <ErrorState message={reviews.error} onRetry={reviews.reload} />}
      {reviews.data && reviews.data.reviews.items.length === 0 && <EmptyState title="No reviews yet" hint="Customers who received this product can leave the first one." />}
      <ul className="space-y-3">
        {reviews.data?.reviews.items.map((r) => (
          <li key={r.id} className="rounded-3xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Stars value={r.rating} />
              <span className="text-xs text-muted-foreground">
                {r.author_name} · {fmtDate(r.created_at)}
              </span>
            </div>
            {r.title && <p className="mt-2 font-medium">{r.title}</p>}
            <p className="text-sm text-muted-foreground">{r.body}</p>
          </li>
        ))}
      </ul>
      {reviews.data && <Pager page={page} total={reviews.data.reviews.pageTotal} onPage={setPage} />}

      {!user && (
        <p className="text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary underline">
            Sign in
          </Link>{" "}
          to review products you have received.
        </p>
      )}
      {user && elig.data && !elig.data.eligible && !sent && elig.data.reason && <p className="text-sm text-muted-foreground">{elig.data.reason}</p>}
      {user && elig.data?.eligible && !sent && (
        <form onSubmit={submit} className="space-y-4 rounded-3xl border bg-card p-5">
          <h3 className="text-lg text-primary">Write a review</h3>
          <div role="radiogroup" aria-label="Rating" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => setRating(n)}
                className={cn("rounded-full border px-3 py-1 text-sm", rating === n ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
              >
                {n}★
              </button>
            ))}
          </div>
          <Field label="Title" htmlFor="rv-title">
            <Input id="rv-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Your review" htmlFor="rv-body" hint="Reviews appear after the bakery approves them.">
            <Textarea id="rv-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Submit review"}
          </Button>
        </form>
      )}
      {sent && <p className="text-sm text-primary">Thanks! Your review will appear once the bakery approves it.</p>}
    </section>
  );
}
