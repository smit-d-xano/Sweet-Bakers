import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, getToken, setToken, type CartItemInput, type User } from "./api.js";

// ---------- auth ----------

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (b: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  signInWithToken: (token: string) => Promise<User>;
  logout: () => void;
  setUser: (u: User) => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => setToken(""))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      setUser,
      login: async (email, password) => {
        const r = await api.login({ email, password });
        setToken(r.token);
        setUser(r.user);
        return r.user;
      },
      signup: async (b) => {
        const r = await api.signup(b);
        setToken(r.token);
        setUser(r.user);
        return r.user;
      },
      signInWithToken: async (token) => {
        setToken(token);
        const u = await api.me();
        setUser(u);
        return u;
      },
      logout: () => {
        setToken("");
        setUser(null);
      },
    }),
    [user, loading],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}

// ---------- cart ----------

interface CartState {
  items: CartItemInput[];
  coupon: string;
  count: number;
  add: (productId: number, variantId: number, qty: number) => void;
  setQty: (productId: number, variantId: number, qty: number) => void;
  remove: (productId: number, variantId: number) => void;
  setCoupon: (code: string) => void;
  clear: () => void;
}

const CartCtx = createContext<CartState | null>(null);
const CART_KEY = "sb_cart";

function readCart(): { items: CartItemInput[]; coupon: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) ?? "null");
    if (raw && Array.isArray(raw.items)) return { items: raw.items, coupon: String(raw.coupon ?? "") };
  } catch {
    /* ignore corrupt storage */
  }
  return { items: [], coupon: "" };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState(readCart);
  const syncedFor = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(state));
  }, [state]);

  // On sign-in, merge the saved cart: keep the local one if it has items, else adopt the saved one.
  useEffect(() => {
    if (!user) {
      syncedFor.current = null;
      return;
    }
    if (syncedFor.current === user.id) return;
    syncedFor.current = user.id;
    api
      .getCart()
      .then((saved) => {
        setState((cur) => (cur.items.length === 0 && saved.items.length > 0 ? { items: saved.items, coupon: saved.coupon_code ?? "" } : cur));
      })
      .catch(() => undefined);
  }, [user]);

  // Persist the cart for signed-in customers so it survives a failed or cancelled payment.
  useEffect(() => {
    if (!user || syncedFor.current !== user.id) return;
    const t = setTimeout(() => {
      api.saveCart({ items: state.items, coupon_code: state.coupon }).catch(() => undefined);
    }, 600);
    return () => clearTimeout(t);
  }, [state, user]);

  const same = (a: CartItemInput, p: number, v: number) => a.product_id === p && a.variant_id === v;

  const value = useMemo<CartState>(
    () => ({
      items: state.items,
      coupon: state.coupon,
      count: state.items.reduce((n, i) => n + i.quantity, 0),
      add: (p, v, qty) =>
        setState((s) => {
          const found = s.items.find((i) => same(i, p, v));
          return {
            ...s,
            items: found
              ? s.items.map((i) => (same(i, p, v) ? { ...i, quantity: i.quantity + qty } : i))
              : [...s.items, { product_id: p, variant_id: v, quantity: qty }],
          };
        }),
      setQty: (p, v, qty) => setState((s) => ({ ...s, items: s.items.map((i) => (same(i, p, v) ? { ...i, quantity: Math.max(1, qty) } : i)) })),
      remove: (p, v) => setState((s) => ({ ...s, items: s.items.filter((i) => !same(i, p, v)) })),
      setCoupon: (code) => setState((s) => ({ ...s, coupon: code })),
      clear: () => setState({ items: [], coupon: "" }),
    }),
    [state],
  );
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const v = useContext(CartCtx);
  if (!v) throw new Error("useCart must be used inside CartProvider");
  return v;
}

// ---------- tiny data hook ----------

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    fn()
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "Something went wrong."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload, setData };
}

// The contexts live in this module, so a hot update would split providers from consumers; reload instead.
if (import.meta.hot) import.meta.hot.dispose(() => window.location.reload());
