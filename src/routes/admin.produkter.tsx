import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Pencil, Trash2, Plus, X, Save, LogOut } from "lucide-react";
import { useProducts } from "@/context/ProductsContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createProductImageUploadUrl } from "@/lib/product-images.functions";
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

function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function fromForm(f: FormState): Product | null {
  const price = Number(f.price);
  if (!f.slug.trim() || !f.name.trim() || Number.isNaN(price)) return null;
  const product: Product = {
    slug: normalizeSlug(f.slug),
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
  const { logout } = useAdminAuth();
  const { products, addProduct, updateProduct, removeProduct } = useProducts();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [serverUploading, setServerUploading] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gallery, setGallery] = useState<
    { name: string; url: string; size: number; mtime: number }[] | null
  >(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const loadGallery = async () => {
    setGalleryLoading(true);
    try {
      const res = await fetch("/api/admin/product-images", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        images: { name: string; url: string; size: number; mtime: number }[];
      };
      setGallery(data.images);
    } catch (err) {
      console.error("Load gallery failed", err);
      setError(
        err instanceof Error
          ? `Kunde inte hämta bilder från servern: ${err.message}`
          : "Kunde inte hämta bilder från servern.",
      );
    } finally {
      setGalleryLoading(false);
    }
  };

  const uploadToServer = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Endast bildfiler tillåts.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Bilden får vara högst 8 MB.");
      return;
    }
    setError(null);
    setServerUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/product-images", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { name: string; url: string };
      setForm((f) => ({ ...f, image: data.url }));
      if (gallery) setGallery([{ ...data, size: file.size, mtime: Date.now() }, ...gallery]);
    } catch (err) {
      console.error("Server upload failed", err);
      setError(
        err instanceof Error
          ? `Bilden kunde inte laddas upp till servern: ${err.message}`
          : "Bilden kunde inte laddas upp till servern.",
      );
    } finally {
      setServerUploading(false);
    }
  };

  const deleteFromServer = async (name: string) => {
    if (!confirm(`Ta bort ${name} från servern?`)) return;
    try {
      const res = await fetch(
        `/api/admin/product-images?name=${encodeURIComponent(name)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setGallery((g) => (g ? g.filter((i) => i.name !== name) : g));
    } catch (err) {
      console.error("Delete failed", err);
      setError(
        err instanceof Error ? `Kunde inte ta bort bilden: ${err.message}` : "Kunde inte ta bort bilden.",
      );
    }
  };

  const startCreate = () => {
    setEditingSlug(null);
    setForm(empty);
    setCreating(true);
    setError(null);
    setNotice(null);
  };

  const startEdit = (p: Product) => {
    setEditingSlug(p.slug);
    setForm(toForm(p));
    setCreating(false);
    setError(null);
    setNotice(null);
  };

  const cancel = () => {
    setEditingSlug(null);
    setCreating(false);
    setForm(empty);
    setError(null);
  };

  const save = async () => {
    const product = fromForm(form);
    if (!product) {
      setError("Slug, namn och giltigt pris krävs.");
      return;
    }
    if (creating && products.some((p) => p.slug === product.slug)) {
      setError("En produkt med denna slug finns redan.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (creating) {
        await addProduct(product);
        setNotice(`Produkten "${product.name}" har lagts till.`);
      } else if (editingSlug) {
        await updateProduct(editingSlug, product);
        setNotice(`Produkten "${product.name}" har sparats.`);
      }
      cancel();
    } catch (err) {
      console.error("Save product failed", err);
      let msg = err instanceof Error ? err.message : "Kunde inte spara.";
      // Zod errors arrive as JSON strings — try to make them readable.
      try {
        const parsed = JSON.parse(msg);
        const issues = Array.isArray(parsed) ? parsed : parsed?.issues;
        if (Array.isArray(issues) && issues[0]?.message) {
          msg = issues.map((i: { path?: (string | number)[]; message: string }) =>
            `${(i.path ?? []).join(".") || "fält"}: ${i.message}`
          ).join("; ");
        }
      } catch { /* not JSON */ }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = creating || editingSlug !== null;

  return (
    <section className="bg-background py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ocean-deep">Produktadmin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Lägg till, redigera eller ta bort produkter. Sparas i butikens databas.
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
              onClick={startCreate}
              disabled={isEditing}
              className="inline-flex items-center gap-2 rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Ny produkt
            </button>
            <Link
              to="/admin/ordrar"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Ordrar
            </Link>
            <Link
              to="/admin/rabattkoder"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Rabattkoder
            </Link>
            <Link
              to="/admin/chatt"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Kundchatt
            </Link>
            <Link
              to="/admin/innehall"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Innehåll
            </Link>
            <Link
              to="/admin/sidor"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Sidor
            </Link>
            <Link
              to="/admin/sakerhet"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Säkerhet
            </Link>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> Logga ut
            </button>
          </div>
        </div>

        {notice && (
          <p className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground" role="status">
            {notice}
          </p>
        )}

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
              <Field label="Produktbild" className="sm:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-sand">
                    {form.image ? (
                      <img src={form.image} alt="Förhandsvisning" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Ingen bild</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          if (!file.type.startsWith("image/")) {
                            setError("Endast bildfiler tillåts.");
                            return;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            setError("Bilden får vara högst 5 MB.");
                            return;
                          }
                          setError(null);
                          setUploading(true);
                          try {
                            const signed = await createProductImageUploadUrl({
                              data: { filename: file.name, contentType: file.type },
                            });
                            const { error: upErr } = await supabase.storage
                              .from(signed.bucket)
                              .uploadToSignedUrl(signed.path, signed.token, file, {
                                contentType: file.type,
                                upsert: false,
                              });
                            if (upErr) throw upErr;
                            setForm((f) => ({ ...f, image: signed.publicUrl }));
                          } catch (err) {
                            console.error("Image upload failed", err);
                            setError(
                              err instanceof Error
                                ? `Bilden kunde inte laddas upp: ${err.message}`
                                : "Bilden kunde inte laddas upp.",
                            );
                          } finally {
                            setUploading(false);
                          }
                        }}
                      />
                      {uploading ? "Laddar upp…" : "Välj bild från datorn"}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={serverUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) await uploadToServer(file);
                          }}
                        />
                        {serverUploading ? "Laddar upp…" : "Ladda upp till servern"}
                      </label>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                        onClick={async () => {
                          setGalleryOpen((v) => !v);
                          if (!gallery) await loadGallery();
                        }}
                      >
                        {galleryOpen ? "Dölj serverbilder" : "Välj från serverbilder"}
                      </button>
                    </div>
                    <input
                      className="input"
                      value={form.image.startsWith("data:") ? "" : form.image}
                      onChange={(e) => setForm({ ...form, image: e.target.value })}
                      placeholder="… eller klistra in en bild-URL"
                    />
                    {form.image && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, image: "" }))}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Ta bort bild
                      </button>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      JPG/PNG/WebP/AVIF, max 5–8 MB. Bildlagret eller servern — välj den som funkar.
                    </p>
                    {galleryOpen && (
                      <div className="mt-2 rounded-md border border-border bg-muted/40 p-2">
                        {galleryLoading && (
                          <p className="text-xs text-muted-foreground">Hämtar bilder…</p>
                        )}
                        {!galleryLoading && gallery && gallery.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Inga bilder uppladdade på servern ännu.
                          </p>
                        )}
                        {!galleryLoading && gallery && gallery.length > 0 && (
                          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                            {gallery.map((img) => {
                              const selected = form.image === img.url;
                              return (
                                <div
                                  key={img.name}
                                  className={`group relative aspect-square overflow-hidden rounded border ${
                                    selected ? "border-ocean-deep ring-2 ring-ocean-deep" : "border-border"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    className="block h-full w-full"
                                    onClick={() => setForm((f) => ({ ...f, image: img.url }))}
                                    title={img.name}
                                  >
                                    <img
                                      src={img.url}
                                      alt={img.name}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteFromServer(img.name)}
                                    className="absolute right-1 top-1 rounded bg-background/80 px-1 text-[10px] text-destructive opacity-0 transition group-hover:opacity-100"
                                    title="Ta bort"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
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
                disabled={saving || uploading}
                className="inline-flex items-center gap-2 rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? "Sparar…" : uploading ? "Vänta…" : "Spara"}
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
                          if (confirm(`Ta bort "${p.name}"?`)) void removeProduct(p.slug);
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
