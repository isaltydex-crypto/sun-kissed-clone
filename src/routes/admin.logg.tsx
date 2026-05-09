import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { listAdminActions } from "@/lib/orders.functions";

export const Route = createFileRoute("/admin/logg")({
  head: () => ({
    meta: [{ title: "Aktivitetslogg — admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  loader: () => listAdminActions(),
  component: AdminLogPage,
});

function AdminLogPage() {
  const { actions } = Route.useLoaderData();

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean-deep text-primary-foreground">
          <ScrollText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ocean-deep">Aktivitetslogg</h1>
          <p className="text-sm text-muted-foreground">{actions.length} senaste händelser</p>
        </div>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tid</th>
              <th className="px-4 py-3">Händelse</th>
              <th className="px-4 py-3">Mål</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Detaljer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {actions.map((a: any) => (
              <tr key={a.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("sv-SE")}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{a.action}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.target ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.ip ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {a.detail && Object.keys(a.detail).length > 0 ? (
                    <pre className="max-w-md overflow-x-auto rounded bg-muted/50 p-2 text-[10px]">
                      {JSON.stringify(a.detail, null, 2)}
                    </pre>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {actions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Inga händelser än.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
