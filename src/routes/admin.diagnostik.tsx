import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, AlertTriangle, AlertOctagon, Info } from "lucide-react";
import { useState } from "react";
import { listDiagnostics, resolveDiagnostic } from "@/lib/diagnostics.functions";

export const Route = createFileRoute("/admin/diagnostik")({
  head: () => ({
    meta: [{ title: "Diagnostik — admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: DiagnosticsPage,
});

type Source = "server" | "client" | "cli" | "container" | "external";
type Severity = "info" | "warn" | "error" | "critical";

const SEVERITY_STYLES: Record<Severity, string> = {
  info: "bg-muted text-muted-foreground",
  warn: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200",
  error: "bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-200",
  critical: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
};

const SEVERITY_ICON: Record<Severity, typeof Info> = {
  info: Info,
  warn: AlertTriangle,
  error: AlertTriangle,
  critical: AlertOctagon,
};

function DiagnosticsPage() {
  const router = useRouter();
  const list = useServerFn(listDiagnostics);
  const resolve = useServerFn(resolveDiagnostic);

  const [source, setSource] = useState<Source | "">("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [showResolved, setShowResolved] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["diagnostics", source, severity, showResolved],
    queryFn: () =>
      list({
        data: {
          source: source || undefined,
          severity: severity || undefined,
          resolved: showResolved ? undefined : false,
          limit: 200,
        },
      }),
    refetchInterval: 15_000,
  });

  const events = data?.events ?? [];
  const summary = data?.summary ?? { info: 0, warn: 0, error: 0, critical: 0, total: 0 };

  async function onResolve(id: string) {
    await resolve({ data: { id } });
    await refetch();
    router.invalidate();
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean-deep text-primary-foreground">
          <Activity className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ocean-deep">Diagnostik</h1>
          <p className="text-sm text-muted-foreground">
            Insamlade fel och händelser från app, klient, containrar och externa tjänster.
          </p>
        </div>
      </header>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["critical", "error", "warn", "info"] as Severity[]).map((s) => {
          const Icon = SEVERITY_ICON[s];
          return (
            <div
              key={s}
              className={`rounded-2xl border border-border p-4 ${SEVERITY_STYLES[s]}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider">{s}</span>
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-semibold">{summary[s]}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as Source | "")}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">Alla källor</option>
          <option value="server">Server</option>
          <option value="client">Klient</option>
          <option value="container">Container</option>
          <option value="external">Extern tjänst</option>
          <option value="cli">CLI</option>
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity | "")}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">Alla nivåer</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
          <option value="info">Info</option>
        </select>
        <label className="ml-2 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          Visa lösta
        </label>
        <button
          onClick={() => refetch()}
          className="ml-auto rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
        >
          Uppdatera
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        {isLoading && (
          <div className="p-8 text-center text-sm text-muted-foreground">Laddar…</div>
        )}
        {!isLoading && events.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Inga händelser. 🎉
          </div>
        )}
        {events.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Senast</th>
                <th className="px-4 py-3">Källa</th>
                <th className="px-4 py-3">Nivå</th>
                <th className="px-4 py-3">Typ</th>
                <th className="px-4 py-3">Meddelande</th>
                <th className="px-4 py-3 text-right">Antal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e: any) => {
                const isOpen = expanded === e.id;
                return (
                  <>
                    <tr key={e.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {new Date(e.last_seen_at).toLocaleString("sv-SE")}
                      </td>
                      <td className="px-4 py-3 text-xs">{e.source}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${SEVERITY_STYLES[e.severity as Severity]}`}
                        >
                          {e.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">{e.kind}</td>
                      <td className="px-4 py-3">
                        <button
                          className="text-left hover:underline"
                          onClick={() => setExpanded(isOpen ? null : e.id)}
                        >
                          {e.message.slice(0, 140)}
                          {e.message.length > 140 ? "…" : ""}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {e.occurrence_count}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!e.resolved ? (
                          <button
                            onClick={() => onResolve(e.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                            title="Markera som löst"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Lös
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-600">Löst</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="space-y-2 text-xs">
                            <div>
                              <strong>Meddelande:</strong>
                              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2">
                                {e.message}
                              </pre>
                            </div>
                            {e.stack && (
                              <div>
                                <strong>Stack:</strong>
                                <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-[10px]">
                                  {e.stack}
                                </pre>
                              </div>
                            )}
                            {e.meta && Object.keys(e.meta).length > 0 && (
                              <div>
                                <strong>Meta:</strong>
                                <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[10px]">
                                  {JSON.stringify(e.meta, null, 2)}
                                </pre>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-3 text-muted-foreground">
                              {e.host && <span>Värd: {e.host}</span>}
                              {e.url && <span>URL: {e.url}</span>}
                              <span>Fingerprint: {e.fingerprint}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
