import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import { BarChart3, Cake, LogOut, Package, Receipt, Star, Tags, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/store";
import { Loading } from "@/components/common";
import { cn } from "cn";

const links = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, end: true },
  { to: "/admin/orders", label: "Orders", icon: Receipt },
  { to: "/admin/products", label: "Products & stock", icon: Package },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
];

export function AdminLayout() {
  const { user, loading, logout } = useAuth();
  if (loading) return <div className="p-8"><Loading rows={3} /></div>;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (user.role !== "admin")
    return (
      <div className="mx-auto max-w-md space-y-3 p-10 text-center">
        <h1 className="text-2xl text-primary">Owners only</h1>
        <p className="text-sm text-muted-foreground">Your account doesn't have access to the bakery's admin panel.</p>
        <Button asChild><Link to="/">Back to the shop</Link></Button>
      </div>
    );
  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="border-b bg-sidebar md:min-h-screen md:w-56 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:block">
          <Link to="/admin" className="flex items-center gap-2 font-display text-lg font-semibold text-primary">
            <Cake className="size-5 text-chart-2" aria-hidden /> SweetBakers
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="Admin">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn("flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-sidebar-accent", isActive && "bg-sidebar-accent text-sidebar-accent-foreground")
              }
            >
              <Icon className="size-4" aria-hidden /> {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={logout}
            className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-sidebar-accent md:mt-4"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}
