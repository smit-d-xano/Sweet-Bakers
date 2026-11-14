import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/store";
import { EmptyState, ErrorState, Pager, ProductCard } from "@/components/common";

const SORTS = [
  ["newest", "Newest"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["rating", "Top rated"],
  ["popular", "Most popular"],
];

const selectClass =
  "h-9 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function Products() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("category_id") ?? "";
  const sort = params.get("sort") ?? "newest";
  const minPrice = params.get("min_price") ?? "";
  const maxPrice = params.get("max_price") ?? "";
  const inStock = params.get("in_stock") === "1";
  const page = Number(params.get("page") ?? 1);

  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next);
  };

  const cats = useAsync(() => api.categories(), []);
  const list = useAsync(
    () =>
      api.products({
        q,
        category_id: category,
        sort,
        min_price: minPrice,
        max_price: maxPrice,
        in_stock: inStock,
        page,
        per_page: 12,
      }),
    [q, category, sort, minPrice, maxPrice, inStock, page],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-primary">Shop</h1>

      <form
        className="grid gap-3 rounded-3xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: search.trim() });
        }}
        role="search"
      >
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input aria-label="Search products" placeholder="Search by name" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select aria-label="Category" className={selectClass} value={category} onChange={(e) => set({ category_id: e.target.value })}>
          <option value="">All categories</option>
          {cats.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Sort by" className={selectClass} value={sort} onChange={(e) => set({ sort: e.target.value })}>
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Input aria-label="Minimum price" type="number" min={0} placeholder="Min $" value={minPrice} onChange={(e) => set({ min_price: e.target.value })} />
          <Input aria-label="Maximum price" type="number" min={0} placeholder="Max $" value={maxPrice} onChange={(e) => set({ max_price: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={inStock} onChange={(e) => set({ in_stock: e.target.checked ? "1" : "" })} />
          In stock only
        </label>
      </form>

      {list.loading && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-label="Loading products">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      )}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {!list.loading && list.data && list.data.items.length === 0 && (
        <EmptyState
          title="No treats match your filters"
          hint="Try a different search, or clear the filters."
          action={
            <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>
              Clear filters
            </Button>
          }
        />
      )}
      {!list.loading && list.data && list.data.items.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">{list.data.itemsTotal} products</p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {list.data.items.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
          <Pager page={page} total={list.data.pageTotal} onPage={(p) => set({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
