import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, fmtDate, money, type Coupon, type OrderStatus } from "@/lib/api";
import { useAsync } from "@/lib/store";
import { EmptyState, ErrorState, Field, Loading, Pager, Stars, StatusBadge, STATUS_LABEL } from "@/components/common";
import { Confirm, selectCls } from "./Catalog";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export function AdminOrders() {
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(() => api.adminOrders({ status, from, to, q, page, per_page: 15 }), [status, from, to, q, page]);
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };
  return (
    <div className="space-y-5">
      <h1 className="text-3xl text-primary">Orders</h1>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">Status
          <select className={`${selectCls} w-44`} value={status} onChange={(e) => reset(setStatus)(e.target.value)}>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="text-xs">From<Input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} /></label>
        <label className="text-xs">To<Input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} /></label>
        <label className="text-xs">Order number<Input placeholder="SB-…" value={q} onChange={(e) => reset(setQ)(e.target.value)} /></label>
      </div>
      {loading && !data ? <Loading /> : error || !data ? <ErrorState message={error} onRetry={reload} /> : data.items.length === 0 ? (
        <EmptyState title="No orders match these filters" />
      ) : (
        <div className="overflow-x-auto rounded-3xl border bg-card">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="p-3 font-medium">Order</th><th className="p-3 font-medium">Placed</th><th className="p-3 font-medium">Customer</th><th className="p-3 font-medium">Status</th><th className="p-3 text-right font-medium">Total</th></tr></thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="border-t hover:bg-accent">
                  <td className="p-3"><Link className="font-medium text-primary underline" to={`/admin/orders/${o.id}`}>{o.order_number}</Link></td>
                  <td className="p-3">{fmtDate(o.created_at)}</td>
                  <td className="p-3">{o.customer_name ?? "—"}</td>
                  <td className="p-3"><StatusBadge status={o.status} /></td>
                  <td className="p-3 text-right">{money(o.total)}</td>
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

const NEXT: Record<string, string[]> = {
  pending: ["cancelled"],
  paid: ["delivered", "cancelled"],
  preparing: ["delivered", "cancelled"],
  out_for_delivery: ["delivered"],
};

export function AdminOrderDetail() {
  const { id = "" } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.adminOrder(Number(id)), [id]);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;
  const { order: o, items, payment, customer } = data;
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const canRefund = ["paid", "preparing", "out_for_delivery", "delivered"].includes(o.status);
  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/admin/orders" className="text-sm text-primary underline">← Orders</Link>
      <div className="space-y-4 rounded-3xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl text-primary">{o.order_number}</h1>
          <StatusBadge status={o.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {customer.name} · {customer.email}{customer.phone ? ` · ${customer.phone}` : ""} · placed {fmtDate(o.created_at)}
        </p>
        <ul className="space-y-1 border-y py-3 text-sm">
          {items.map((i) => <li key={i.id} className="flex justify-between"><span>{i.quantity} × {i.name_snapshot}</span><span>{money(i.line_total)}</span></li>)}
        </ul>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
          {o.discount > 0 && <div className="flex justify-between"><dt>Discount {o.coupon_code && `(${o.coupon_code})`}</dt><dd>-{money(o.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Tax</dt><dd>{money(o.tax)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{money(o.delivery_fee)}</dd></div>
          <div className="flex justify-between text-base font-semibold text-primary"><dt>Total</dt><dd>{money(o.total)}</dd></div>
        </dl>
        <p className="text-sm">{o.delivery_type === "pickup" ? "Pickup" : "Delivery"} · {o.delivery_date} · {o.delivery_slot}{o.address_text ? ` · ${o.address_text}` : ""}</p>
        {o.notes && <p className="text-sm">Notes: {o.notes}</p>}
        {payment && <p className="text-sm text-muted-foreground">Payment: {payment.provider} · {payment.status} · {money(payment.amount)} {payment.provider_ref && `· ${payment.provider_ref}`}</p>}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {(NEXT[o.status] ?? []).map((s) => (
            s === "cancelled" ? (
              <Confirm key={s} trigger={<Button variant="outline" disabled={busy}>Cancel order</Button>} title="Cancel this order?" text="Stock is returned if it was already paid." onConfirm={() => act(() => api.setOrderStatus(o.id, s), "Order cancelled")} />
            ) : (
              <Button key={s} disabled={busy} onClick={() => act(() => api.setOrderStatus(o.id, s), `Marked ${STATUS_LABEL[s as OrderStatus].toLowerCase()}`)}>Mark {STATUS_LABEL[s as OrderStatus].toLowerCase()}</Button>
            )
          ))}
          {canRefund && (
            <Confirm trigger={<Button variant="destructive" disabled={busy}>Refund</Button>} title="Refund this order?" text="The customer is refunded in full and stock is returned." onConfirm={() => act(() => api.refundOrder(o.id), "Order refunded")} />
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminReviews() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(() => api.adminReviews({ status, page, per_page: 10 }), [status, page]);
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-3xl text-primary">Reviews</h1>
      <div className="flex gap-2" role="group" aria-label="Filter">
        {[["pending", "Awaiting approval"], ["approved", "Approved"], ["other", "Hidden"]].map(([v, l]) => (
          <Button key={v} size="sm" variant={status === v ? "default" : "outline"} aria-pressed={status === v} onClick={() => { setStatus(v); setPage(1); }}>{l}</Button>
        ))}
      </div>
      {loading && !data ? <Loading /> : error || !data ? <ErrorState message={error} onRetry={reload} /> : data.items.length === 0 ? (
        <EmptyState title="No reviews here" />
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id} className="space-y-2 rounded-3xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars value={r.rating} />
                <span className="text-xs text-muted-foreground">{r.product_name} · {r.author_name} · {fmtDate(r.created_at)}</span>
              </div>
              {r.title && <p className="font-medium">{r.title}</p>}
              <p className="text-sm">{r.body}</p>
              <div className="flex gap-2">
                {r.is_approved ? (
                  <Button size="sm" variant="outline" onClick={() => act(() => api.setReviewApproval(r.id, false))}>Hide</Button>
                ) : (
                  <Button size="sm" onClick={() => act(() => api.setReviewApproval(r.id, true))}>Approve</Button>
                )}
                <Confirm trigger={<Button size="sm" variant="ghost" aria-label="Delete review"><Trash2 className="size-4" /></Button>} title="Delete this review?" text="This can't be undone." onConfirm={() => act(() => api.deleteReview(r.id))} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={page} total={data.pageTotal} onPage={setPage} />}
    </div>
  );
}

const toDate = (t: number | null) => (t ? new Date(t).toISOString().slice(0, 10) : "");
const toMs = (d: string, end = false) => (d ? new Date(`${d}T${end ? "23:59:59" : "00:00:00"}Z`).getTime() : null);

type CouponForm = { id: number | null; code: string; type: "percent" | "flat"; value: string; min_order: string; valid_from: string; valid_to: string; usage_limit: string; is_active: boolean };
const blankCoupon: CouponForm = { id: null, code: "", type: "percent", value: "10", min_order: "0", valid_from: "", valid_to: "", usage_limit: "0", is_active: true };

export function AdminCoupons() {
  const { data, error, loading, reload } = useAsync(() => api.coupons(), []);
  const [f, setF] = useState<CouponForm | null>(null);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;
  const edit = (c: Coupon) => setF({ id: c.id, code: c.code, type: c.type, value: String(c.value), min_order: String(c.min_order), valid_from: toDate(c.valid_from), valid_to: toDate(c.valid_to), usage_limit: String(c.usage_limit), is_active: c.is_active });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f) return;
    const body: Record<string, unknown> = {
      type: f.type, value: Number(f.value), min_order: Number(f.min_order), valid_from: toMs(f.valid_from), valid_to: toMs(f.valid_to, true),
      usage_limit: Number(f.usage_limit), is_active: f.is_active,
    };
    try {
      if (f.id) await api.updateCoupon(f.id, body);
      else await api.createCoupon({ ...body, code: f.code.trim().toUpperCase() });
      toast.success("Coupon saved");
      setF(null);
      reload();
    } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl text-primary">Coupons</h1>
        <Button onClick={() => setF(blankCoupon)}>Add coupon</Button>
      </div>
      {f && (
        <form onSubmit={save} className="grid gap-3 rounded-3xl border bg-card p-5 sm:grid-cols-3">
          <Field label="Code" htmlFor="cp-code"><Input id="cp-code" required disabled={!!f.id} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
          <Field label="Type" htmlFor="cp-type">
            <select id="cp-type" className={selectCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as "percent" | "flat" })}>
              <option value="percent">Percent off</option><option value="flat">Flat amount off</option>
            </select>
          </Field>
          <Field label={f.type === "percent" ? "Percent" : "Amount (USD)"} htmlFor="cp-val"><Input id="cp-val" type="number" min="0" step="0.01" required value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
          <Field label="Minimum order" htmlFor="cp-min"><Input id="cp-min" type="number" min="0" step="0.01" value={f.min_order} onChange={(e) => setF({ ...f, min_order: e.target.value })} /></Field>
          <Field label="Valid from" htmlFor="cp-from"><Input id="cp-from" type="date" value={f.valid_from} onChange={(e) => setF({ ...f, valid_from: e.target.value })} /></Field>
          <Field label="Valid to" htmlFor="cp-to"><Input id="cp-to" type="date" value={f.valid_to} onChange={(e) => setF({ ...f, valid_to: e.target.value })} /></Field>
          <Field label="Usage limit" htmlFor="cp-lim" hint="0 means unlimited"><Input id="cp-lim" type="number" min="0" value={f.usage_limit} onChange={(e) => setF({ ...f, usage_limit: e.target.value })} /></Field>
          <label className="flex items-center gap-2 self-center text-sm"><input type="checkbox" className="size-4 accent-primary" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />Active</label>
          <div className="flex gap-2 sm:col-span-3"><Button type="submit">Save coupon</Button><Button type="button" variant="ghost" onClick={() => setF(null)}>Cancel</Button></div>
        </form>
      )}
      {data.length === 0 ? <EmptyState title="No coupons yet" /> : (
        <ul className="divide-y rounded-3xl border bg-card">
          {data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold">{c.code} {!c.is_active && <span className="text-xs font-normal text-muted-foreground">(inactive)</span>}</p>
                <p className="text-muted-foreground">
                  {c.type === "percent" ? `${c.value}% off` : `${money(c.value)} off`} · min {money(c.min_order)} · used {c.used_count ?? 0}{c.usage_limit ? `/${c.usage_limit}` : ""}
                  {c.valid_to ? ` · until ${toDate(c.valid_to)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => edit(c)}>Edit</Button>
                <Confirm trigger={<Button size="sm" variant="ghost" aria-label={`Delete ${c.code}`}><Trash2 className="size-4" /></Button>} title={`Delete ${c.code}?`} text="Past orders keep their discount." onConfirm={async () => { try { await api.deleteCoupon(c.id); reload(); } catch (e) { toast.error(errMsg(e)); } }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
