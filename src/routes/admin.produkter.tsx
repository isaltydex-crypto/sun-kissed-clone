import { createFileRoute, Link, Navigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Pencil, Trash2, Plus, X, Save, RotateCcw, LogOut } from "lucide-react";
import { useProducts } from "@/context/ProductsContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import type { Product } from "@/data/products";

export const Route = createFileRoute("/admin/produkter")({
  head: () => ({
    meta: [
      { title: "Admin — Produkter" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminProductsPage,
});

type FormState = {
  slug: string;
  name: string;
  tagline: string;
  price: string;
  oldPrice: string;
  image: string;
  badge: string;
};

const empty: FormState = {
  slug: "",
  name: "",
  tagline: "",
  price: "",
  oldPrice: "",
  image: "",
  badge: "",
};

function toForm(p: Product): FormState {
  return {
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    price: String(p.price),
    oldPrice: p.oldPrice != null ? String(p.oldPrice) : "",
    image: p.image,
    badge: p.badge ?? "",
  };
}

function fromForm(f: FormState): Product | null {
  const price = Number(f.price);
  if (!f.slug.trim() || !f.name.trim() || Number.isNaN(price)) return null;
  const product: Product = {
    slug: f.slug.trim(),
    name: f.name.trim(),
    tagline: f.tagline.trim(),
    price,
    image: f.image.trim(),
  };
  const oldPrice = Number(f.oldPrice);
  if (f.oldPrice.trim() && !Number.isNaN(oldPrice)) product.oldPrice = oldPrice;
  if (f.badge.trim()) product.badge = f.badge.trim();
  return product;
}

function AdminProductsPage() {
  const { isAuthenticated, logout } = useAdminAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" search={{ redirect: pathname }} />;
  }
  const { products, addProduct, updateProduct, removeProduct, resetToDefaults } = useProducts();
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCreate = () => {
    setEditingSlug(null);
    setForm(empty);
    setCreating(true);
    setError(null);
  };

  const startEdit = (p: Product) => {
    setEditingSlug(p.slug);
    setForm(toForm(p));
    setCreating(false);
    setError(null);
  };

  const cancel = () => {
    setEditingSlug(null);
    setCreating(false);
    setForm(empty);
    setError(null);
  };

  const save = () => {
    const product = fromForm(form);
    if (!product) {
      setError("Slug, namn och giltigt pris krävs.");
      return;
    }
    if (creating) {
      if (products.some((p) => p.slug === product.slug)) {
        setError("En produkt med denna slug finns redan.");
        return;
      }
      addProduct(product);
    } else if (editingSlug) {
      updateProduct(editingSlug, product);
    }
    cancel();
  };

  const isEditing = creating || editingSlug !== null;

  return (
    <section className="bg-background py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ocean-deep">Produktadmin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Lägg till, redigera eller ta bort produkter. Sparas lokalt i webbläsaren.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/produkter"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Visa butiken
            </Link>
            <button
              onClick={resetToDefaults}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" /> Återställ
            </button>
            <button
              onClick={startCreate}
              disabled={isEditing}
              className="inline-flex items-center gap-2 rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Ny produkt
            </button>
          </div>
        </div>

        {isEditing && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {creating ? "Ny produkt" : `Redigera: ${form.name}`}
              </h2>
              <button onClick={cancel} className="rounded-md p-1 hover:bg-muted" aria-label="Stäng">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Slug (unik)" required>
                <input
                  className="input"
                  value={form.slug}
                  disabled={!creating}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="t.ex. peptide-serum"
                />
              </Field>
              <Field label="Namn" required>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Tagline" className="sm:col-span-2">
                <input
                  className="input"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                />
              </Field>
              <Field label="Pris (kr)" required>
                <input
                  type="number"
                  className="input"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </Field>
              <Field label="Tidigare pris (kr)">
                <input
                  type="number"
                  className="input"
                  value={form.oldPrice}
                  onChange={(e) => setForm({ ...form, oldPrice: e.target.value })}
                />
              </Field>
              <Field label="Bild-URL" className="sm:col-span-2">
                <input
                  className="input"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="https://..."
                />
              </Field>
              <Field label="Badge (valfri)">
                <input
                  className="input"
                  value={form.badge}
                  onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  placeholder="Bästsäljare, Rea, Nytt..."
                />
              </Field>
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={cancel}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Avbryt
              </button>
              <button
                onClick={save}
                className="inline-flex items-center gap-2 rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean"
              >
                <Save className="h-4 w-4" /> Spara
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Bild</th>
                <th className="px-4 py-3">Produkt</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Pris</th>
                <th className="px-4 py-3">Badge</th>
                <th className="px-4 py-3 text-right">Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.slug} className="border-t border-border">
                  <td className="px-4 py-3">
                    <img
                      src={p.image}
                      alt=""
                      className="h-12 w-12 rounded-md object-cover bg-sand"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.tagline}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.slug}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ocean-deep">{p.price} kr</div>
                    {p.oldPrice && (
                      <div className="text-xs text-muted-foreground line-through">
                        {p.oldPrice} kr
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{p.badge ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(p)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Redigera
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Ta bort "${p.name}"?`)) removeProduct(p.slug);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Ta bort
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Inga produkter. Klicka "Ny produkt" för att lägga till.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: 2px solid hsl(var(--ring));
          outline-offset: -1px;
        }
      `}</style>
    </section>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}
