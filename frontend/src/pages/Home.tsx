import { Link } from "react-router-dom";
import { ArrowRight, Heart, Truck, Wheat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/store";
import { ErrorState, Loading, ProductCard } from "@/components/common";

export default function Home() {
  const { data, error, loading, reload } = useAsync(() => api.home(), []);

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 overflow-hidden rounded-[2rem] bg-secondary/60 p-6 sm:p-10 md:grid-cols-2">
        <div className="space-y-5">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">Small-batch bakery</p>
          <h1 className="text-4xl font-semibold leading-tight text-primary sm:text-5xl">Baked with butter, love and a little patience.</h1>
          <p className="max-w-md text-muted-foreground">
            Celebration cakes, slow-fermented breads, flaky pastries and cookies — baked fresh each morning and ready for pickup or delivery.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/products">
                Shop now <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#story">Our story</a>
            </Button>
          </div>
        </div>
        <div className="relative">
          <img src="/hero.svg" alt="A frosted chocolate cake and fresh bread" className="w-full rounded-3xl" />
          {[
            { e: "🧁", cls: "left-2 top-4 text-4xl", d: "0s" },
            { e: "🥐", cls: "right-3 top-10 text-4xl", d: "0.8s" },
            { e: "🍪", cls: "bottom-6 left-6 text-3xl", d: "1.6s" },
            { e: "🍰", cls: "bottom-4 right-6 text-4xl", d: "2.4s" },
          ].map((t) => (
            <span key={t.e} aria-hidden className={`float-treat pointer-events-none absolute drop-shadow ${t.cls}`} style={{ animationDelay: t.d }}>
              {t.e}
            </span>
          ))}
        </div>
      </section>

      <div className="ticker overflow-hidden rounded-full bg-primary py-2 text-primary-foreground" aria-hidden>
        <div className="ticker-track flex w-max gap-10 whitespace-nowrap text-sm font-medium">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-10">
              {["🧁 Fresh every morning", "🎂 Custom celebration cakes", "🥖 Slow-fermented breads", "🍪 Warm cookies", "🥐 Buttery pastries", "💳 Secure online payment"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {loading && <Loading rows={4} />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <section aria-labelledby="cats">
            <h2 id="cats" className="mb-4 text-2xl text-primary">
              Shop by category
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {data.categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/products?category_id=${c.id}`}
                  className="rounded-3xl border bg-card p-5 transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="font-display text-xl text-primary">{c.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="featured">
            <div className="mb-4 flex items-end justify-between">
              <h2 id="featured" className="text-2xl text-primary">
                Featured favourites
              </h2>
              <Link to="/products" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {data.featured.slice(0, 8).map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          </section>

          <section aria-labelledby="best">
            <h2 id="best" className="mb-4 text-2xl text-primary">
              Best sellers
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {data.best_sellers.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          </section>
        </>
      )}

      <section id="story" className="grid gap-6 rounded-[2rem] bg-card p-6 sm:p-10 md:grid-cols-3">
        <div className="md:col-span-3">
          <h2 className="text-3xl text-primary">Our story</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            SweetBakers started in a tiny Brooklyn kitchen with one sourdough starter and a rolling pin inherited from grandma. Today we still bake in small
            batches, use real butter and local flour, and never rush a rise.
          </p>
        </div>
        {[
          { icon: Wheat, title: "Honest ingredients", text: "Local flour, farm eggs and French butter — nothing artificial." },
          { icon: Heart, title: "Made by hand", text: "Every loaf is shaped and every cake is decorated by our bakers." },
          { icon: Truck, title: "Pickup or delivery", text: "Order by evening, choose a slot, and we bring it to your door." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-3xl bg-secondary/50 p-5">
            <Icon className="size-6 text-primary" aria-hidden />
            <h3 className="mt-2 text-lg text-primary">{title}</h3>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
