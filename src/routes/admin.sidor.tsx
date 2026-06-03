import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save, X } from "lucide-react";
import {
  adminFetchAll,
  adminUpsertPage,
  adminDeletePage,
  type CustomPage,
} from "@/server/site-content.functions";
} from "@/lib/site-content.functions";

export const Route = createFileRoute("/admin/sidor")({
  head: () => ({
    meta: [
      { title: "Admin — Sidor" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPagesPage,
});

type FormState = {
  id?: string;
  slug: string;
  title: string;
  body: string;
  in_menu: boolean;
  menu_label: string;
  menu_order: number;
  published: boolean;
  meta_description: string;
};

const empty: FormState = {
  slug: "",
  title: "",
  body: "",
  in_menu: false,
  menu_label: "",
  menu_order: 100,
  published: true,
  meta_description: "",
};

function AdminPagesPage() {
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await adminFetchAll({ data: {} as never });
      setPages(res.pages);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const startEdit = (p: CustomPage) =>
    setForm({
      id: p.id,
      slug: p.slug,
      title: p.title,
      body: p.body,
      in_menu: p.in_menu,
      menu_label: p.menu_label ?? "",
      menu_order: p.menu_order,
      published: p.published,
      meta_description: p.meta_description ?? "",
    });

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      await adminUpsertPage({
        data: {
          id: form.id,
          slug: form.slug,
          title: form.title,
          body: form.body,
          in_menu: form.in_menu,
          menu_label: form.menu_label || null,
          menu_order: form.menu_order,
          published: form.published,
          meta_description: form.meta_description || null,
        },
      });
      setForm(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Ta bort sidan permanent?")) return;
    try {
      await adminDeletePage({ data: { id } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-8">
        <Link to="/admin/produkter" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </Link>
        <div className="mt-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Egna sidor</h1>
          <button
            onClick={() => setForm({ ...empty })}
            className="inline-flex items-center gap-2 rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean"
          >
            <Plus className="h-4 w-4" /> Ny sida
          </button>
        </div>
        {error && <p className="mt-4 rounded bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        {form && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{form.id ? `Redigera: ${form.title}` : "Ny sida"}</h2>
              <button onClick={() => setForm(null)} aria-label="Stäng" className="rounded p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Titel">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Slug (URL)" hint={`/sida/${form.slug || "..."}`}>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  className={inputCls}
                  placeholder="t-ex-leveransvillkor"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Innehåll">
                  <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={10} className={inputCls} />
                </Field>
              </div>
              <Field label="Meta-beskrivning (SEO)">
                <input value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Menyetikett (om i meny)">
                <input value={form.menu_label} onChange={(e) => setForm({ ...form, menu_label: e.target.value })} placeholder={form.title} className={inputCls} />
              </Field>
              <Field label="Sortering i meny">
                <input
                  type="number"
                  value={form.menu_order}
                  onChange={(e) => setForm({ ...form, menu_order: Number(e.target.value) || 100 })}
                  className={inputCls}
                />
              </Field>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.in_menu} onChange={(e) => setForm({ ...form, in_menu: e.target.checked })} />
                  Visa i meny
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                  Publicerad
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setForm(null)} className="rounded-md border border-border px-4 py-2 text-sm">
                Avbryt
              </button>
              <button
                onClick={save}
                disabled={busy || !form.title.trim() || !form.slug.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {busy ? "Sparar…" : "Spara"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
          {pages.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Inga egna sidor ännu.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pages.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-foreground">{p.title}</h3>
                      {!p.published && <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase">Utkast</span>}
                      {p.in_menu && <span className="rounded bg-ocean/10 px-2 py-0.5 text-[10px] uppercase text-ocean">I meny</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">/sida/{p.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(p)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                      Redigera
                    </button>
                    <button onClick={() => remove(p.id)} className="rounded-md p-2 text-destructive hover:bg-destructive/10" aria-label="Ta bort">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
