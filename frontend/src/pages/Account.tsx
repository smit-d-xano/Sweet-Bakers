import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, fmtDate, money, type Address } from "@/lib/api";
import { useAsync, useAuth } from "@/lib/store";
import { EmptyState, ErrorState, Field, Loading, Pager, StatusBadge } from "@/components/common";

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl text-primary">Hi, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            logout();
            navigate("/");
          }}
        >
          Sign out
        </Button>
      </div>
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="pt-4">
          <Orders />
        </TabsContent>
        <TabsContent value="addresses" className="pt-4">
          <Addresses />
        </TabsContent>
        <TabsContent value="profile" className="pt-4">
          <Profile />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Orders() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(() => api.orders(page), [page]);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;
  if (data.items.length === 0)
    return (
      <EmptyState
        title="No orders yet"
        hint="When you place an order you can track it here."
        action={
          <Button asChild>
            <Link to="/products">Start shopping</Link>
          </Button>
        }
      />
    );
  return (
    <div className="space-y-3">
      {data.items.map((o) => (
        <Link key={o.id} to={`/account/orders/${o.order_number}`} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-card p-4 transition hover:bg-accent">
          <div>
            <p className="font-medium">{o.order_number}</p>
            <p className="text-sm text-muted-foreground">
              Placed {fmtDate(o.created_at)} · {o.delivery_type === "pickup" ? "Pickup" : "Delivery"} {o.delivery_date}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={o.status} />
            <span className="font-semibold">{money(o.total)}</span>
          </div>
        </Link>
      ))}
      <Pager page={page} total={data.pageTotal} onPage={setPage} />
    </div>
  );
}

const STEPS = ["paid", "preparing", "out_for_delivery", "delivered"] as const;

export function OrderDetail() {
  const { orderNumber = "" } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.order(orderNumber), [orderNumber]);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error || "Order not found."} onRetry={reload} />;
  const { order: o, items } = data;
  const step = STEPS.indexOf(o.status as (typeof STEPS)[number]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/account" className="text-sm text-primary underline">
        ← All orders
      </Link>
      <div className="space-y-4 rounded-3xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl text-primary">{o.order_number}</h1>
          <StatusBadge status={o.status} />
        </div>
        {step >= 0 && (
          <ol className="grid grid-cols-4 gap-2 text-center text-xs" aria-label="Order progress">
            {STEPS.map((s, i) => (
              <li key={s} className={i <= step ? "font-semibold text-primary" : "text-muted-foreground"}>
                <div className={`mx-auto mb-1 h-2 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
                {s.replace(/_/g, " ")}
              </li>
            ))}
          </ol>
        )}
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
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
          {o.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-{money(o.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Tax</dt><dd>{money(o.tax)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{money(o.delivery_fee)}</dd></div>
          <div className="flex justify-between text-base font-semibold text-primary"><dt>Total</dt><dd>{money(o.total)}</dd></div>
        </dl>
        <p className="text-sm text-muted-foreground">
          {o.delivery_type === "pickup" ? "Pickup" : "Delivery"} · {o.delivery_date} · {o.delivery_slot}
          {o.address_text ? ` · ${o.address_text}` : ""}
        </p>
        {o.notes && <p className="text-sm">Notes: {o.notes}</p>}
        {o.status === "pending" && (
          <Button asChild disabled={busy} onClick={() => setBusy(true)}>
            <Link to={`/pay/demo/${o.order_number}`}>Complete payment</Link>
          </Button>
        )}
        {o.status === "delivered" && (
          <div className="flex flex-wrap gap-2">
            {items.map((i) => (
              <Button key={i.id} asChild variant="outline" size="sm">
                <Link to={`/products?q=${encodeURIComponent(i.name_snapshot.split(" (")[0])}`}>Review {i.name_snapshot.split(" (")[0]}</Link>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const blank = { line1: "", line2: "", city: "", state: "", postal_code: "", is_default: false };

function Addresses() {
  const { data, error, loading, reload } = useAsync(() => api.addresses(), []);
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  const open = (a: Address | "new") => {
    setEditing(a);
    setForm(a === "new" ? blank : { line1: a.line1, line2: a.line2, city: a.city, state: a.state, postal_code: a.postal_code, is_default: a.is_default });
  };
  const text = (k: "line1" | "line2" | "city" | "state" | "postal_code") => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing === "new") await api.addAddress(form);
      else if (editing) await api.updateAddress(editing.id, form);
      toast.success("Address saved");
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the address.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-4">
      {data.length === 0 && !editing && <EmptyState title="No saved addresses" hint="Add one to speed up delivery checkout." />}
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.map((a) => (
          <li key={a.id} className="space-y-2 rounded-3xl border bg-card p-4 text-sm">
            <p>
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}
              <br />
              {a.city}, {a.state} {a.postal_code}
            </p>
            {a.is_default && <p className="text-xs font-medium text-primary">Default address</p>}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => open(a)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await api.deleteAddress(a.id);
                    reload();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not delete.");
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!editing && <Button onClick={() => open("new")}>Add address</Button>}
      {editing && (
        <form onSubmit={save} className="grid gap-3 rounded-3xl border bg-card p-5 sm:grid-cols-2">
          <Field label="Street address" htmlFor="ac-1"><Input id="ac-1" required value={form.line1} onChange={text("line1")} /></Field>
          <Field label="Apartment, suite" htmlFor="ac-2"><Input id="ac-2" value={form.line2} onChange={text("line2")} /></Field>
          <Field label="City" htmlFor="ac-3"><Input id="ac-3" required value={form.city} onChange={text("city")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State" htmlFor="ac-4"><Input id="ac-4" required value={form.state} onChange={text("state")} /></Field>
            <Field label="ZIP" htmlFor="ac-5"><Input id="ac-5" required value={form.postal_code} onChange={text("postal_code")} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="size-4 accent-primary" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            Make this my default address
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>Save</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="max-w-md space-y-4 rounded-3xl border bg-card p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          setUser(await api.updateProfile({ name, phone }));
          toast.success("Profile updated");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not update your profile.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Full name" htmlFor="pf-name"><Input id="pf-name" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Email" htmlFor="pf-email"><Input id="pf-email" value={user?.email ?? ""} disabled /></Field>
      <Field label="Phone" htmlFor="pf-phone"><Input id="pf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}
