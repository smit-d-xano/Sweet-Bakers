import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Field } from "@/components/common";
import { api } from "@/lib/api";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ token: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api.forgotPassword({ email });
      setDone({ token: r.reset_token });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-5 rounded-3xl border bg-card p-8">
      <h1 className="text-3xl text-primary">Forgot your password?</h1>
      {done ? (
        <div className="space-y-3 text-sm">
          <p>If an account exists for {email}, we've sent a link to choose a new password.</p>
          {done.token && (
            <p className="rounded-xl bg-muted p-3 text-muted-foreground">
              Email isn't set up on this store yet, so here is your link:{" "}
              <Link to={`/reset-password?token=${done.token}`} className="font-medium text-primary underline">
                choose a new password
              </Link>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">Enter your email and we'll send you a link to reset it.</p>
          <Field label="Email" htmlFor="fp-email">
            <Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="text-center text-sm">
        <Link to="/login" className="font-medium text-primary underline">Back to sign in</Link>
      </p>
    </div>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.resetPassword({ token, password });
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-5 rounded-3xl border bg-card p-8">
      <h1 className="text-3xl text-primary">Choose a new password</h1>
      {!token ? (
        <p className="text-sm text-destructive">This reset link is missing its code. Please request a new one.</p>
      ) : done ? (
        <p className="text-sm">Your password is updated. Taking you to sign in…</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" htmlFor="rp-pw" hint="At least 8 characters.">
            <PasswordInput id="rp-pw" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : "Update password"}
          </Button>
        </form>
      )}
      <p className="text-center text-sm">
        <Link to="/forgot-password" className="font-medium text-primary underline">Request a new link</Link>
      </p>
    </div>
  );
}
