import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Tag, Plus, Trash2, X, Save } from "lucide-react";
import {
  listDiscountCodes,
  upsertDiscountCode,
  deleteDiscountCode,
  type DbDiscountCode,
} from "@/lib/discounts.functions";

export const Route = createFileRoute("/admin/rabattkoder")({
  head: () => ({
    meta: [
      { title: "Rabattkoder — admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: () => listDiscountCodes(),
  component: AdminDiscountsPage,
});

type FormState = {
  id?: string;
  code: string;
  type: "percent" | "fixed";
  value: string;
  minSubtotal: string; // SEK
  expiresAt: string; // YYYY-MM-DD or empty
  maxUses: string;
  active: boolean;
  description: string;
};

const empty: FormState = {
  code: "",
  type: "percent",
  value: "",
  minSubtotal: "",
  expiresAt: "",
  maxUses: "",
  active: true,
  description: "",
};

function fromRow(r: DbDiscountCode): FormState {
  return {
    id: r.id,
    code: r.code,
    type: r.type,
    value: String(r.value),
    minSubtotal: r.min_subtotal_ore != null ? String(r.min_subtotal_ore / 100) : "",
    expiresAt: r.expires_at ? r.expires_at.slice(0, 10) : "",
    maxUses: r.max_uses != null ? String(r.max_uses) : "",
    active: r.active,
    description: r.description ?? "",
  };
}

function AdminDiscountsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCreate = () => {
    setError(null);
    setForm({ ...empty });
  };
  const startEdit = (r: DbDiscountCode) => {
    setError(null);
    setForm(fromRow(r));
  };
  const cancel = () => {
    setForm(null);
    setError(null);
  };

  const save = async () => {
    if (!form) return;
    setError(null);
    const value = Number(form.value);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Värdet måste vara ett positivt tal.");
      return;
    }
    if (form.type === "percent" && value > 100) {
      setError("Procent kan inte vara högre än 100.");
      return;
    }
    setBusy(true);
    try {
      await upsertDiscountCode({
        data: {
          id: form.id,
          code: form.code.trim(),
          type: form.type,
          value,
          minSubtotalOre: form.minSubtotal
            ? Math.round(Number(form.minSubtotal) * 100)
            : null,
          expiresAt: form.expiresAt
            ? new Date(`${form.expiresAt}T23:59:59Z`).toISOString()
            : null,
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          active: form.active,
          description: form.description.trim() || null,
        },
      });
      setForm(null);
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara koden.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Ta bort koden permanent?")) return;
    setBusy(true);
    try {
      await deleteDiscountCode({ data: { id } });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Kunde inte ta bort.");
    } finally {
      setBusy(false);
    }
  };

  const inputBase =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ocean focus:outline-none focus:ring-2 focus:ring-ocean/30";
  const labelBase = "mb-1 block text-xs font-semibold uppercase tracking-wider text-ocean-deep";

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean-deep text-primary-foreground">
            <Tag className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ocean-deep">Rabattkoder</h1>
            <p className="text-sm text-muted-foreground">{data.codes.length} kod(er)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/produkter"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            ← Produkter
          </Link>
          <button
            onClick={startCreate}
            disabled={!!form}
            className="inline-flex items-center gap-2 rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Ny kod
          </button>
        </div>
      </header>

      {form && (
        <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {form.id ? `Redigera: ${form.code}` : "Ny rabattkod"}
            </h2>
            <button onClick={cancel} className="rounded-md p-1 hover:bg-muted" aria-label="Stäng">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelBase}>Kod</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className={inputBase}
                placeholder="WELCOME10"
                maxLength={40}
              />
            </div>
            <div>
              <label className={labelBase}>Typ</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as "percent" | "fixed" })}
                className={inputBase}
              >
                <option value="percent">Procent (%)</option>
                <option value="fixed">Fast belopp (kr)</option>
              </select>
            </div>
            <div>
              <label className={labelBase}>
                Värde {form.type === "percent" ? "(1–100)" : "(kr)"}
              </label>
              <input
                type="number"
                min={0}
                step={form.type === "percent" ? 1 : 0.01}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className={inputBase}
              />
            </div>
            <div>
              <label className={labelBase}>Minsta varukorg (kr)</label>
              <input
                type="number"
                min={0}
                value={form.minSubtotal}
                onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })}
                className={inputBase}
                placeholder="valfritt"
              />
            </div>
            <div>
              <label className={labelBase}>Giltig t.o.m.</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className={inputBase}
              />
            </div>
            <div>
              <label className={labelBase}>Max antal användningar</label>
              <input
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className={inputBase}
                placeholder="valfritt"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelBase}>Beskrivning</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputBase}
                placeholder="Visas för kunden, t.ex. ”10% nybörjarrabatt”"
                maxLength={200}
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="active"
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="active" className="text-sm text-foreground">
                Aktiv
              </label>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={cancel}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Avbryt
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Spara
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Kod</th>
              <th className="px-4 py-3">Typ</th>
              <th className="px-4 py-3 text-right">Värde</th>
              <th className="px-4 py-3 text-right">Min. order</th>
              <th className="px-4 py-3">Giltig t.o.m.</th>
              <th className="px-4 py-3 text-right">Använd</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.codes.map((r: DbDiscountCode) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-4 py-3 font-mono font-semibold text-ocean-deep">{r.code}</td>
                <td className="px-4 py-3">{r.type === "percent" ? "Procent" : "Fast"}</td>
                <td className="px-4 py-3 text-right">
                  {r.type === "percent" ? `${r.value}%` : `${r.value} kr`}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {r.min_subtotal_ore != null ? `${(r.min_subtotal_ore / 100).toFixed(0)} kr` : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.expires_at ? r.expires_at.slice(0, 10) : "—"}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {r.used_count}
                  {r.max_uses != null ? ` / ${r.max_uses}` : ""}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.active ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(r)}
                      className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
                    >
                      Redigera
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Ta bort
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.codes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Inga rabattkoder ännu. Klicka på <em>Ny kod</em> för att skapa en.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
