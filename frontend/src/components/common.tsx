import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Inbox, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { imgUrl, money, type OrderStatus, type Product } from "@/lib/api";
import { cn } from "cn";

export function Loading({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-3xl border border-destructive/30 bg-card p-8 text-center">
      <AlertCircle className="size-8 text-destructive" aria-hidden />
      <p className="text-sm text-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed bg-card/60 p-10 text-center">
      <Inbox className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn("size-4", n <= Math.round(value) ? "fill-chart-3 text-chart-3" : "text-border")} aria-hidden />
        ))}
      </span>
      {count !== undefined && <span className="text-muted-foreground">({count})</span>}
    </span>
  );
}

export function ProductCard({ p }: { p: Product }) {
  const out = p.stock_qty <= 0 || !p.is_available;
  return (
    <Link
      to={`/products/${p.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img src={imgUrl(p.images?.[0])} alt={p.name} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
        {out && <Badge className="absolute left-3 top-3 bg-foreground text-background">Out of stock</Badge>}
        {!out && p.is_featured && <Badge className="absolute left-3 top-3 bg-accent text-accent-foreground">Featured</Badge>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-lg leading-tight">{p.name}</h3>
        <Stars value={p.rating_avg ?? 0} count={p.rating_count ?? 0} />
        <p className="mt-auto pt-2 text-lg font-semibold text-primary">{money(p.price)}</p>
      </div>
    </Link>
  );
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending payment",
  paid: "Paid",
  preparing: "Paid",
  out_for_delivery: "Paid",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  paid: "bg-secondary text-secondary-foreground",
  preparing: "bg-secondary text-secondary-foreground",
  out_for_delivery: "bg-secondary text-secondary-foreground",
  delivered: "bg-primary text-primary-foreground",
  cancelled: "bg-destructive/15 text-destructive",
  refunded: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge className={cn("rounded-full", STATUS_STYLE[status])}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-3 pt-4" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {total}
      </span>
      <Button variant="outline" size="sm" disabled={page >= total} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
