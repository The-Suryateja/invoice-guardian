import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — InvoiceGuard" },
      { name: "description", content: "Sign in or create your InvoiceGuard account." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => {
    const next = typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined;
    return next ? { next } : {};
  },
  component: AuthPage,
});

type View = "signin" | "signup" | "forgot" | "otp-email" | "otp-verify";

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (next) window.location.replace(next);
      else navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate, next]);

  function goNext() {
    if (next) window.location.replace(next);
    else navigate({ to: "/dashboard", replace: true });
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (view === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: next ? `${window.location.origin}${next}` : window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent. Check your email.");
      setView("signin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onOtpSend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      toast.success("Verification code sent to your email.");
      setOtp("");
      setView("otp-verify");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
      if (error) throw error;
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid verification code");
    } finally {
      setBusy(false);
    }
  }

  const isPasswordView = view === "signin" || view === "signup";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-semibold">
          <Shield className="size-5 text-primary" />
          InvoiceGuard
        </Link>
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          {/* Header */}
          {isPasswordView && (
            <>
              <h1 className="text-lg font-semibold">
                {view === "signin" ? "Sign in to your account" : "Create your account"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {view === "signin"
                  ? "Welcome back. Enter your details below."
                  : "Start processing invoices in under a minute."}
              </p>
            </>
          )}
          {view === "forgot" && (
            <>
              <h1 className="text-lg font-semibold">Reset your password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your email and we'll send you a reset link.
              </p>
            </>
          )}
          {view === "otp-email" && (
            <>
              <h1 className="text-lg font-semibold">Sign in with a verification code</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll email you a 6-digit code. No password required.
              </p>
            </>
          )}
          {view === "otp-verify" && (
            <>
              <h1 className="text-lg font-semibold">Enter your code</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a 6-digit code to <span className="text-foreground">{email}</span>.
              </p>
            </>
          )}

          {/* Password (sign-in / sign-up) */}
          {isPasswordView && (
            <form onSubmit={onPasswordSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {view === "signin" && (
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete={view === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : view === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
          )}

          {/* Forgot password */}
          {view === "forgot" && (
            <form onSubmit={onForgotSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email-forgot">Email</Label>
                <Input
                  id="email-forgot"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : "Send reset link"}
              </Button>
            </form>
          )}

          {/* OTP: request code */}
          {view === "otp-email" && (
            <form onSubmit={onOtpSend} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email-otp">Email</Label>
                <Input
                  id="email-otp"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Sending…" : "Send verification code"}
              </Button>
            </form>
          )}

          {/* OTP: verify code */}
          {view === "otp-verify" && (
            <form onSubmit={onOtpVerify} className="mt-6 space-y-4">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} inputMode="numeric">
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full" disabled={busy || otp.length !== 6}>
                {busy ? "Verifying…" : "Verify & sign in"}
              </Button>
              <button
                type="button"
                onClick={onOtpSend}
                disabled={busy}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Resend code
              </button>
            </form>
          )}

          {/* Footer switches */}
          <div className="mt-4 space-y-2">
            {isPasswordView && (
              <>
                <button
                  type="button"
                  onClick={() => setView(view === "signin" ? "signup" : "signin")}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  {view === "signin"
                    ? "Don't have an account? Sign up"
                    : "Already have an account? Sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtp("");
                    setView("otp-email");
                  }}
                  className="w-full text-center text-sm font-medium text-primary hover:underline"
                >
                  Sign in using verification code instead
                </button>
              </>
            )}
            {(view === "forgot" || view === "otp-email" || view === "otp-verify") && (
              <button
                type="button"
                onClick={() => setView("signin")}
                className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
