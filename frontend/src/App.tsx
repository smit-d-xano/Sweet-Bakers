import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { AuthProvider, CartProvider, useAuth } from "@/lib/store";
import { StoreLayout } from "@/components/StoreLayout";
import { Loading } from "@/components/common";
import Home from "@/pages/Home";
import Products from "@/pages/Products";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import { CheckoutResult, DemoPay } from "@/pages/Pay";
import AuthPage from "@/pages/Auth";
import { ForgotPassword, ResetPassword } from "@/pages/PasswordReset";
import Account, { OrderDetail } from "@/pages/Account";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import { AdminCategories, AdminProductForm, AdminProducts } from "@/pages/admin/Catalog";
import { AdminCoupons, AdminOrderDetail, AdminOrders, AdminReviews } from "@/pages/admin/Sales";

function RequireUser() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading rows={3} />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <Outlet />;
}

function NotFound() {
  return (
    <div className="space-y-3 py-16 text-center">
      <h1 className="text-3xl text-primary">Page not found</h1>
      <p className="text-muted-foreground">That page isn't on our menu.</p>
      <Button asChild><Link to="/">Back to the bakery</Link></Button>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route element={<StoreLayout />}>
              <Route index element={<Home />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:slug" element={<ProductDetail />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="checkout/success" element={<CheckoutResult kind="success" />} />
              <Route path="checkout/cancelled" element={<CheckoutResult kind="cancelled" />} />
              <Route path="pay/demo/:orderNumber" element={<DemoPay />} />
              <Route path="login" element={<AuthPage mode="login" />} />
              <Route path="signup" element={<AuthPage mode="signup" />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password" element={<ResetPassword />} />
              <Route element={<RequireUser />}>
                <Route path="account" element={<Account />} />
                <Route path="account/orders/:orderNumber" element={<OrderDetail />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="orders/:id" element={<AdminOrderDetail />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="products/:id" element={<AdminProductForm />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="coupons" element={<AdminCoupons />} />
            </Route>
          </Routes>
          <Toaster />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
