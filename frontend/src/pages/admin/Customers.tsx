import { useState } from "react";
import { Input } from "@/components/ui/input";
import { api, fmtDate, money } from "@/lib/api";
import { useAsync } from "@/lib/store";
import { EmptyState, ErrorState, Loading } from "@/components/common";

export function AdminCustomers() {
  const { data, error, loading, reload } = useAsync(() => api.customers(), []);
  const [q, setQ] = useState("");
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error} onRetry={reload} />;
  const term = q.trim().toLowerCase();
  const rows = data.filter((c) => !term || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(term));
  return (
    <div className="space-y-5">
      <h1 className="text-3xl text-primary">Customers</h1>
      <Input className="max-w-xs" placeholder="Search name, email or phone" aria-label="Search customers" value={q} onChange={(e) => setQ(e.target.value)} />
      {rows.length === 0 ? <EmptyState title="No customers found" /> : (
        <div className="overflow-x-auto rounded-3xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="p-3 font-medium">Customer</th><th className="p-3 font-medium">Phone</th><th className="p-3 font-medium">Joined</th>
                <th className="p-3 font-medium">Orders</th><th className="p-3 font-medium">Total spent</th><th className="p-3 font-medium">Last order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3"><p className="font-medium">{c.name}</p><p className="text-muted-foreground">{c.email}</p></td>
                  <td className="p-3">{c.phone || "—"}</td>
                  <td className="p-3">{fmtDate(c.created_at)}</td>
                  <td className="p-3">{c.order_count}</td>
                  <td className="p-3 font-medium">{money(c.total_spent)}</td>
                  <td className="p-3">{c.last_order_at ? fmtDate(c.last_order_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
