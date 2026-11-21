import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { api, imgUrl, money, type Product, type Variant } from "@/lib/api";
import { useAsync } from "@/lib/store";
import { EmptyState, ErrorState, Field, Loading, Pager } from "@/components/common";

export const selectCls = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function Confirm({ trigger, title, text, onConfirm }: { trigger: React.ReactNode; title: string; text: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export function AdminProducts() {
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const cats = useAsync(() => api.categories(), []);
  const { data, error, loading, reload } = useAsync(() => api.adminProducts({ q, category_id: categoryId, page, per_page: 15 }), [q, categoryId, page]);

  const patch = async (p: Product, change: Partial<Product>) => {
    try {
      await api.saveProduct(p.id, { ...productBody(p), ...change });
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl text-primary">Products</h1>
        <Button asChild><Link to="/admin/products/new">Add product</Link></Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="Search by name" aria-label="Search products" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className={`${selectCls} max-w-48`} aria-label="Category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {loading && !data ? <Loading /> : error || !data ? <ErrorState message={error} onRetry={reload} /> : data.items.length === 0 ? (
        <EmptyState title="No products found" />
      ) : (
        <div className="overflow-x-auto rounded-3xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="p-3 font-medium">Product</th><th className="p-3 font-medium">Price</th><th className="p-3 font-medium">Stock</th>
                <th className="p-3 font-medium">Available</th><th className="p-3 font-medium">Featured</th><th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <img src={imgUrl(p.images[0])} alt="" className="size-10 rounded-xl object-cover" />
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="p-3">{money(p.price)}</td>
                  <td className="p-3">
                    <Input
                      key={`${p.id}-${p.stock_qty}`}
                      type="number"
                      min="0"
                      step="1"
                      aria-label={`Stock for ${p.name}`}
                      className={`h-8 w-20 ${p.stock_qty < 10 ? "font-semibold text-destructive" : ""}`}
                      defaultValue={p.stock_qty}
                      onBlur={(e) => {
                        const n = Math.max(0, Math.floor(Number(e.target.value)));
                        if (Number.isFinite(n) && n !== p.stock_qty) patch(p, { stock_qty: n });
                      }}
                    />
                  </td>
                  <td className="p-3"><input type="checkbox" className="size-4 accent-primary" aria-label={`${p.name} available`} checked={p.is_available} onChange={(e) => patch(p, { is_available: e.target.checked })} /></td>
                  <td className="p-3"><input type="checkbox" className="size-4 accent-primary" aria-label={`${p.name} featured`} checked={p.is_featured} onChange={(e) => patch(p, { is_featured: e.target.checked })} /></td>
                  <td className="space-x-2 p-3 text-right">
                    <Button asChild size="sm" variant="outline"><Link to={`/admin/products/${p.id}`}>Edit</Link></Button>
                    <Confirm
                      trigger={<Button size="sm" variant="ghost" aria-label={`Delete ${p.name}`}><Trash2 className="size-4" /></Button>}
                      title={`Delete ${p.name}?`}
                      text="This removes the product from the shop. Past orders keep their details."
                      onConfirm={async () => {
                        try { await api.deleteProduct(p.id); toast.success("Product deleted"); reload(); } catch (e) { toast.error(errMsg(e)); }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} total={data.pageTotal} onPage={setPage} />}
    </div>
  );
}

function productBody(p: Product) {
  return {
    category_id: p.category_id, name: p.name, description: p.description, price: p.price, images: p.images, stock_qty: p.stock_qty,
    is_available: p.is_available, is_featured: p.is_featured, allergens: p.allergens, weight_or_size: p.weight_or_size,
  };
}

export function AdminProductForm() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const cats = useAsync(() => api.categories(), []);
  const existing = useAsync(() => (isNew ? Promise.resolve(null) : api.adminProduct(Number(id))), [id]);
  if (existing.loading || cats.loading) return <Loading />;
  if (existing.error || cats.error) return <ErrorState message={existing.error || cats.error} onRetry={existing.reload} />;
  return (
    <Form
      key={id}
      product={existing.data?.product ?? null}
      variants={existing.data?.variants ?? []}
      categories={cats.data ?? []}
      onSaved={(p) => (isNew ? navigate(`/admin/products/${p.id}`, { replace: true }) : existing.reload())}
      reloadVariants={existing.reload}
    />
  );
}

function Form({ product, variants, categories, onSaved, reloadVariants }: { product: Product | null; variants: Variant[]; categories: { id: number; name: string }[]; onSaved: (p: Product) => void; reloadVariants: () => void }) {
  const [f, setF] = useState({
    category_id: product?.category_id ?? categories[0]?.id ?? 0,
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: String(product?.price ?? ""),
    stock_qty: String(product?.stock_qty ?? 0),
    weight_or_size: product?.weight_or_size ?? "",
    allergens: (product?.allergens ?? []).join(", "),
    images: product?.images ?? [],
    is_available: product?.is_available ?? true,
    is_featured: product?.is_featured ?? false,
  });
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await api.saveProduct(product?.id ?? null, {
        ...f,
        price: Number(f.price),
        stock_qty: Math.max(0, Math.floor(Number(f.stock_qty))),
        category_id: Number(f.category_id),
        allergens: f.allergens.split(",").map((a) => a.trim()).filter(Boolean),
      });
      toast.success("Product saved");
      onSaved(saved);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.[0]) return;
    try {
      const { path } = await api.upload(files[0]);
      set("images", [...f.images, path]);
    } catch (err) {
      toast.error(errMsg(err));
    }
    if (file.current) file.current.value = "";
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/admin/products" className="text-sm text-primary underline">← Products</Link>
      <h1 className="text-3xl text-primary">{product ? `Edit ${product.name}` : "New product"}</h1>
      <form onSubmit={save} className="grid gap-4 rounded-3xl border bg-card p-6 sm:grid-cols-2">
        <Field label="Name" htmlFor="p-name"><Input id="p-name" required value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Category" htmlFor="p-cat">
          <select id="p-cat" className={selectCls} value={f.category_id} onChange={(e) => set("category_id", Number(e.target.value))}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Price (USD)" htmlFor="p-price"><Input id="p-price" type="number" min="0" step="0.01" required value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
        <Field label="Stock" htmlFor="p-stock"><Input id="p-stock" type="number" min="0" step="1" required value={f.stock_qty} onChange={(e) => set("stock_qty", e.target.value)} /></Field>
        <Field label="Weight or size" htmlFor="p-size"><Input id="p-size" value={f.weight_or_size} onChange={(e) => set("weight_or_size", e.target.value)} /></Field>
        <Field label="Allergens" htmlFor="p-all" hint="Comma separated, e.g. gluten, dairy, eggs"><Input id="p-all" value={f.allergens} onChange={(e) => set("allergens", e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="p-desc"><Textarea id="p-desc" rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <p className="text-sm font-medium">Images</p>
          <div className="flex flex-wrap gap-3">
            {f.images.map((img, i) => (
              <div key={img + i} className="relative">
                <img src={imgUrl(img)} alt={`Product image ${i + 1}`} className="size-20 rounded-2xl object-cover" />
                <button type="button" aria-label="Remove image" className="absolute -right-2 -top-2 rounded-full bg-destructive px-1.5 text-xs text-white" onClick={() => set("images", f.images.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files)} />
            <Button type="button" variant="outline" className="size-20 flex-col rounded-2xl" onClick={() => file.current?.click()}><Upload className="size-4" />Upload</Button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={f.is_available} onChange={(e) => set("is_available", e.target.checked)} />Available for sale</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={f.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />Featured on home page</label>
        <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save product"}</Button></div>
      </form>
      {product && <Variants productId={product.id} variants={variants} reload={reloadVariants} />}
    </div>
  );
}

function Variants({ productId, variants, reload }: { productId: number; variants: Variant[]; reload: () => void }) {
  const [v, setV] = useState({ label: "", price_delta: "0", stock_qty: "0" });
  const body = (x: { label: string; price_delta: string | number; stock_qty: string | number }) => ({ label: x.label, price_delta: Number(x.price_delta), stock_qty: Number(x.stock_qty) });
  return (
    <section className="space-y-3 rounded-3xl border bg-card p-6">
      <h2 className="text-lg text-primary">Variants</h2>
      {variants.length === 0 && <p className="text-sm text-muted-foreground">No variants. Add sizes or options such as "1 kg" or "Eggless".</p>}
      <ul className="space-y-2">
        {variants.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{x.label} · {x.price_delta >= 0 ? "+" : ""}{money(x.price_delta)} · {x.stock_qty} in stock</span>
            <Button size="sm" variant="ghost" aria-label={`Delete ${x.label}`} onClick={async () => { try { await api.deleteVariant(x.id); reload(); } catch (e) { toast.error(errMsg(e)); } }}><Trash2 className="size-4" /></Button>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-3 sm:grid-cols-4 sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          try { await api.addVariant(productId, body(v)); setV({ label: "", price_delta: "0", stock_qty: "0" }); reload(); } catch (err) { toast.error(errMsg(err)); }
        }}
      >
        <Field label="Label" htmlFor="v-l"><Input id="v-l" required value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} /></Field>
        <Field label="Price change" htmlFor="v-p"><Input id="v-p" type="number" step="0.01" value={v.price_delta} onChange={(e) => setV({ ...v, price_delta: e.target.value })} /></Field>
        <Field label="Stock" htmlFor="v-s"><Input id="v-s" type="number" min="0" value={v.stock_qty} onChange={(e) => setV({ ...v, stock_qty: e.target.value })} /></Field>
        <Button type="submit" variant="outline">Add variant</Button>
      </form>
    </section>
  );
}

export function AdminCategories() {
  const { data, error, loading, reload } = useAsync(() => api.categories(), []);
  const [editing, setEditing] = useState<{ id: number | null; name: string; description: string } | null>(null);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl text-primary">Categories</h1>
        <Button onClick={() => setEditing({ id: null, name: "", description: "" })}>Add category</Button>
      </div>
      {editing && (
        <form
          className="space-y-3 rounded-3xl border bg-card p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            try { await api.saveCategory(editing.id, { name: editing.name, description: editing.description }); toast.success("Category saved"); setEditing(null); reload(); } catch (err) { toast.error(errMsg(err)); }
          }}
        >
          <Field label="Name" htmlFor="c-n"><Input id="c-n" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="Description" htmlFor="c-d"><Input id="c-d" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
          <div className="flex gap-2"><Button type="submit">Save</Button><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
        </form>
      )}
      {data.length === 0 ? <EmptyState title="No categories yet" /> : (
        <ul className="divide-y rounded-3xl border bg-card">
          {data.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 p-4">
              <div><p className="font-medium">{c.name}</p><p className="text-sm text-muted-foreground">/{c.slug}{c.description ? ` · ${c.description}` : ""}</p></div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing({ id: c.id, name: c.name, description: c.description })}>Edit</Button>
                <Confirm
                  trigger={<Button size="sm" variant="ghost" aria-label={`Delete ${c.name}`}><Trash2 className="size-4" /></Button>}
                  title={`Delete ${c.name}?`}
                  text="Categories that still have products can't be deleted."
                  onConfirm={async () => { try { await api.deleteCategory(c.id); reload(); } catch (e) { toast.error(errMsg(e)); } }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
