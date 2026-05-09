import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Copy } from "lucide-react";
import { generateTotpSetup, getTotpStatus } from "@/lib/admin-2fa.functions";

export const Route = createFileRoute("/admin/sakerhet")({
  head: () => ({
    meta: [
      { title: "Säkerhet — 2FA" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminSecurityPage,
  loader: async () => {
    const status = await getTotpStatus();
    return { status };
  },
});

function AdminSecurityPage() {
  const { status } = Route.useLoaderData();
  const [setup, setSetup] = useState<{ secret: string; otpauth: string; qrDataUrl: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await generateTotpSetup();
      setSetup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte generera secret.");
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => navigator.clipboard.writeText(text);

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean-deep text-primary-foreground">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ocean-deep">Tvåfaktorsautentisering</h1>
          <p className="text-sm text-muted-foreground">
            Status:{" "}
            <strong className={status.required ? "text-emerald-600" : "text-amber-600"}>
              {status.required ? "Aktiverad" : "Inte konfigurerad"}
            </strong>
          </p>
        </div>
      </header>

      <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-2 text-sm text-foreground">
          <p>
            2FA aktiveras genom att sätta <code className="rounded bg-muted px-1">ADMIN_TOTP_SECRET</code> i serverns
            miljövariabler. När en secret finns konfigurerad krävs en 6-siffrig engångskod
            tillsammans med lösenordet vid inloggning.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Generera en ny secret nedan.</li>
            <li>Skanna QR-koden i en authenticator-app (Aegis, 1Password, Google Authenticator).</li>
            <li>
              Lägg till <code className="rounded bg-muted px-1">ADMIN_TOTP_SECRET=…</code> i din{" "}
              <code className="rounded bg-muted px-1">.env</code> och starta om appen.
            </li>
          </ol>
        </div>

        <button
          onClick={onGenerate}
          disabled={busy}
          className="rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean disabled:opacity-60"
        >
          {busy ? "Genererar..." : "Generera ny secret"}
        </button>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {setup && (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <img
                src={setup.qrDataUrl}
                alt="QR-kod för authenticator-app"
                className="h-44 w-44 rounded-md border border-border bg-white p-2"
              />
              <div className="flex-1 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Secret (Base32)
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={setup.secret}
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => copy(setup.secret)}
                      className="rounded-md border border-border px-3 text-sm hover:bg-muted"
                      aria-label="Kopiera secret"
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    otpauth URL
                  </label>
                  <textarea
                    readOnly
                    rows={3}
                    value={setup.otpauth}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Viktigt: Denna secret visas bara en gång. Spara den nu och lägg in den i serverns{" "}
              <code className="rounded bg-amber-100 px-1">.env</code> som{" "}
              <code className="rounded bg-amber-100 px-1">ADMIN_TOTP_SECRET</code>.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
