import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { getTotpStatus } from "@/lib/admin-2fa.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin login" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/admin/produkter",
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { login, isAuthenticated, logout } = useAdminAuth();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/admin/login" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getTotpStatus()
      .then((s) => setTotpRequired(s.required))
      .catch(() => setTotpRequired(false));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await login(password, totpRequired ? code : undefined);
    setBusy(false);
    if (result.ok) {
      navigate({ to: redirect });
    } else {
      setError(result.error);
    }
  };

  return (
    <section className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ocean-deep text-primary-foreground">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-ocean-deep">Admin-inloggning</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Endast åtkomlig via direkt URL.
          </p>
        </div>

        {isAuthenticated ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-foreground">Du är redan inloggad.</p>
            <div className="flex flex-col gap-2">
              <Link
                to="/admin/produkter"
                className="rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean"
              >
                Till produktadmin
              </Link>
              <button
                onClick={logout}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Logga ut
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" aria-label="Admin-inloggning">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Lösenord
              </span>
              <input
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ocean"
              />
            </label>
            {totpRequired && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  2FA-kod
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tracking-[0.4em] text-foreground focus:outline-none focus:ring-2 focus:ring-ocean"
                  placeholder="123456"
                />
              </label>
            )}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean disabled:opacity-60"
            >
              {busy ? "Loggar in..." : "Logga in"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
