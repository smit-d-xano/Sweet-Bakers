import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { Cake, LayoutDashboard, Menu, ShoppingBag, User as UserIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useCart } from "@/lib/store";
import { cn } from "cn";

const nav = [
  { to: "/", label: "Home", end: true },
  { to: "/products", label: "Shop" },
];

export function StoreLayout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  const link = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-accent", isActive && "bg-accent text-accent-foreground");

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:p-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold text-primary">
            <Cake className="size-6 text-chart-2" aria-hidden /> SweetBakers
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Button asChild variant="ghost" size="sm">
                <Link to="/account">
                  <UserIcon aria-hidden /> <span className="max-w-24 truncate">{user.name.split(" ")[0]}</span>
                </Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
            <Button asChild size="sm" className="relative">
              <Link to="/cart" aria-label={`Cart, ${count} items`}>
                <ShoppingBag aria-hidden /> Cart
                {count > 0 && <span className="ml-1 rounded-full bg-secondary px-1.5 text-xs text-secondary-foreground">{count}</span>}
              </Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {open && (
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 border-t px-4 py-3" aria-label="Menu">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={link} onClick={() => setOpen(false)}>
                {n.label}
              </NavLink>
            ))}
            {user && (
              <button
                className="rounded-full px-3 py-1.5 text-left text-sm font-medium hover:bg-accent"
                onClick={() => {
                  logout();
                  setOpen(false);
                  navigate("/");
                }}
              >
                Sign out
              </button>
            )}
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t bg-secondary/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            <span className="font-display text-base text-primary">SweetBakers</span> — baked fresh every morning.
          </p>
          <p>Open daily 7am – 6pm · 12 Maple Street, Brooklyn NY</p>
        </div>
      </footer>
    </div>
  );
}
