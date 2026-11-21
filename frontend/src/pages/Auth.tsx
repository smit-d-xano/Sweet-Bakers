import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/store";
import { Field } from "@/components/common";
import { PasswordInput } from "@/components/PasswordInput";

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = mode === "login" ? await login(email, password) : await signup({ name, email, password, phone });
      navigate(u.role === "admin" && next === "/" ? "/admin" : next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-5 rounded-3xl border bg-card p-8">
      <h1 className="text-3xl text-primary">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <Field label="Full name" htmlFor="au-name">
            <Input id="au-name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
        )}
        <Field label="Email" htmlFor="au-email">
          <Input id="au-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Password" htmlFor="au-pw" hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <PasswordInput
            id="au-pw"
            required
            minLength={mode === "signup" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </Field>
        {mode === "login" && (
          <div className="-mt-2 text-right text-sm">
            <Link to="/forgot-password" className="text-primary underline">Forgot password?</Link>
          </div>
        )}
        {mode === "signup" && (
          <Field label="Phone (optional)" htmlFor="au-phone">
            <Input id="au-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </Field>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link to={`/signup?next=${encodeURIComponent(next)}`} className="font-medium text-primary underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link to={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-primary underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
