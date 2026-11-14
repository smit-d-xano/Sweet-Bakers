import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, fmtDate, money, type Dashboard as Dash, type Metric } from "@/lib/api";
import { useAsync } from "@/lib/store";
import { ErrorState, Loading, Stars, StatusBadge } from "@/components/common";
import { cn } from "cn";

const PERIODS = [
  ["day", "Daily"],
  ["week", "Weekly"],
  ["month", "Monthly"],
  ["year", "Yearly"],
] as const;
const PREV: Record<string, string> = { day: "yesterday", week: "last week", month: "last month", year: "last year", custom: "previous period" };

function Delta({ m, period }: { m: Metric; period: string }) {
  if (m.change_pct === null || m.change_pct === undefined) return <span className="text-xs text-muted-foreground">No data {PREV[period]}</span>;
  const up = m.change_pct > 0;
  const flat = m.change_pct === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", flat ? "text-muted-foreground" : up ? "text-primary" : "text-destructive")}>
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : ""}
      {m.change_pct.toFixed(0)}% vs {PREV[period]}
    </span>
  );
}

function Kpi({ label, m, fmt, period, invert }: { label: string; m: Metric; fmt: (n: number) => string; period: string; invert?: boolean }) {
  const shown = invert && m.change_pct !== null ? { ...m, change_pct: m.change_pct } : m;
  return (
    <div className="space-y-1 rounded-3xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-semibold text-primary">{fmt(m.value)}</p>
      <Delta m={shown} period={period} />
    </div>
  );
}

function LineChart({ data }: { data: Dash["revenue_series"] }) {
  const W = 800, H = 260, P = { l: 56, r: 12, t: 12, b: 32 };
  const max = Math.max(1, ...data.flatMap((d) => [d.revenue, d.previous]));
  const x = (i: number) => P.l + (data.length <= 1 ? 0 : (i * (W - P.l - P.r)) / (data.length - 1));
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max);
  const path = (k: "revenue" | "previous") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const step = Math.max(1, Math.ceil(data.length / 8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue over time">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(max * t)} y2={y(max * t)} className="stroke-border" />
          <text x={P.l - 6} y={y(max * t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
            ${Math.round(max * t).toLocaleString()}
          </text>
        </g>
      ))}
      <path d={path("previous")} fill="none" className="stroke-chart-3" strokeWidth={2} strokeDasharray="5 4" />
      <path d={path("revenue")} fill="none" className="stroke-chart-1" strokeWidth={3} strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.revenue)} r={3.5} className="fill-chart-1">
            <title>{`${d.label}: ${money(d.revenue)} (${d.orders} orders)`}</title>
          </circle>
          {i % step === 0 && (
            <text x={x(i)} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function Bars({ rows, fmt }: { rows: { label: string; value: number }[]; fmt: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[110px_1fr_70px] items-center gap-2 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="h-4 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-chart-2" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{fmt(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

const Card = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <section className={cn("space-y-3 rounded-3xl border bg-card p-5", className)}>
    <h2 className="text-lg text-primary">{title}</h2>
    {children}
  </section>
);

function TopTable({ rows, by }: { rows: Dash["top_products_by_revenue"]; by: "revenue" | "quantity" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pb-2 font-medium">#</th>
            <th className="pb-2 font-medium">Product</th>
            <th className="pb-2 text-right font-medium">Qty</th>
            <th className="pb-2 text-right font-medium">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className="border-t">
              <td className="py-1.5">{i + 1}</td>
              <td>{r.name}</td>
              <td className={cn("text-right", by === "quantity" && "font-semibold")}>{r.quantity}</td>
              <td className={cn("text-right", by === "revenue" && "font-semibold")}>{money(r.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState<string>("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const { data, error, loading, reload } = useAsync(
    () => api.dashboard(custom ? { period: "custom", from: custom.from, to: custom.to } : { period }),
    [period, custom?.from, custom?.to],
  );
  const active = custom ? "custom" : period;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-primary">Dashboard</h1>
          {data && (
            <p className="text-sm text-muted-foreground">
              {data.range.from_date} – {data.range.to_date} · compared with {data.range.prev_from_date} – {data.range.prev_to_date}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex rounded-full border bg-card p-1" role="group" aria-label="Period">
            {PERIODS.map(([v, l]) => (
              <button
                key={v}
                aria-pressed={active === v}
                onClick={() => {
                  setCustom(null);
                  setPeriod(v);
                }}
                className={cn("rounded-full px-4 py-1.5 text-sm font-medium", active === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                {l}
              </button>
            ))}
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (from && to) setCustom({ from, to });
            }}
          >
            <label className="text-xs">
              From
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
            </label>
            <label className="text-xs">
              To
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
            </label>
            <Button type="submit" variant={custom ? "default" : "outline"} disabled={!from || !to}>
              Apply
            </Button>
          </form>
        </div>
      </div>

      {loading && !data && <Loading rows={4} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className={cn("space-y-6", loading && "opacity-60 transition")}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Revenue" m={data.kpis.revenue} fmt={money} period={active} />
            <Kpi label="Orders" m={data.kpis.orders} fmt={(n) => String(n)} period={active} />
            <Kpi label="Avg. order value" m={data.kpis.avg_order_value} fmt={money} period={active} />
            <Kpi label="New customers" m={data.kpis.new_customers} fmt={(n) => String(n)} period={active} />
            <Kpi label="Items sold" m={data.kpis.items_sold} fmt={(n) => String(n)} period={active} />
            <Kpi label="Cancelled / refunded" m={data.kpis.cancelled_refunded} fmt={(n) => String(n)} period={active} invert />
          </div>

          <Card title={`Revenue by ${data.range.bucket}`}>
            <LineChart data={data.revenue_series} />
            <p className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-0.5 w-5 bg-chart-1" /> This period</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-5 border-t-2 border-dashed border-chart-3" /> Previous period</span>
            </p>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Orders by status">
              <Bars rows={data.orders_by_status.map((s) => ({ label: s.status.replace(/_/g, " "), value: s.count }))} fmt={(n) => String(n)} />
            </Card>
            <Card title="Sales by category">
              <Bars rows={data.sales_by_category.map((s) => ({ label: s.name, value: s.revenue }))} fmt={money} />
            </Card>
            <Card title="Top 10 products by revenue">
              <TopTable rows={data.top_products_by_revenue} by="revenue" />
            </Card>
            <Card title="Top 10 products by quantity">
              <TopTable rows={data.top_products_by_quantity} by="quantity" />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Latest orders">
              <ul className="space-y-2 text-sm">
                {data.latest_orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{o.order_number}</span>
                      <span className="block text-xs text-muted-foreground">{fmtDate(o.created_at)}</span>
                    </span>
                    <span className="flex items-center gap-2"><StatusBadge status={o.status} />{money(o.total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Low stock">
              {data.low_stock.length === 0 ? (
                <p className="text-sm text-muted-foreground">Everything is well stocked.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.low_stock.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>{p.name}</span>
                      <span className={p.stock_qty === 0 ? "font-semibold text-destructive" : "font-medium"}>{p.stock_qty} left</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Latest reviews">
              {data.latest_reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {data.latest_reviews.map((r) => (
                    <li key={r.id}>
                      <Stars value={r.rating} />
                      <p className="line-clamp-2 text-muted-foreground">{r.title || r.body}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.author_name}{!r.is_approved && " · awaiting approval"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
