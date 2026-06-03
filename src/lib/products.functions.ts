/**
 * Products: server-backed CRUD so the catalog is shared across all devices.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminAuthMiddleware } from "@/lib/admin-middleware";
import type { Product } from "@/data/products";

const ProductInput = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug måste vara små bokstäver, siffror och bindestreck"),
  name: z.string().trim().min(1).max(200),
  tagline: z.string().trim().max(400).default(""),
  price: z.number().int().min(0).max(10_000_000),
  oldPrice: z.number().int().min(0).max(10_000_000).optional().nullable(),
  image: z.string().max(8_000_000).default(""),
  badge: z.string().trim().max(60).optional().nullable(),
  description: z.string().max(20_000).default(""),
});

const ProductSnapshot = z
  .object({
    products: z.array(ProductInput),
  })
  .passthrough();

type Row = {
  slug: string;
  name: string;
  tagline: string;
  price_ore: number;
  old_price_ore: number | null;
  image: string;
  badge: string | null;
  sort_order: number;
  description: string | null;
};

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function normalizeProductImageUrl(image: string): string {
  const siteBase = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (!siteBase || !image) return image;
  try {
    const url = new URL(image);
    if (
      url.pathname.startsWith("/storage/v1/object/public/product-images/") ||
      url.pathname.startsWith("/storage/v1/render/image/public/product-images/")
    ) {
      // Keep storage images relative to the app origin. Absolute URLs saved
      // before this fix may point at an internal/API/custom domain that does
      // not match the visitor's current host and can render as a broken image.
      return `${url.pathname}${url.search}`;
    }
  } catch {
    // Relative and seed images are already served by the app.
  }
  return image;
}

function rowToProduct(r: Row): Product {
  return {
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    price: Math.round(r.price_ore / 100),
    oldPrice: r.old_price_ore != null ? Math.round(r.old_price_ore / 100) : undefined,
    image: normalizeProductImageUrl(r.image),
    badge: r.badge ?? undefined,
    description: r.description ?? "",
  };
}

function snapshotFile() {
  return process.env.PRODUCTS_SNAPSHOT_FILE || "";
}

async function fetchProductRows(): Promise<Row[]> {
  const supabaseAdmin = await getAdminClient();
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("slug,name,tagline,price_ore,old_price_ore,image,badge,sort_order,description")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

async function writeProductsSnapshot(products: Product[]) {
  const file = snapshotFile();
  if (!file) return;
  try {
    const [{ mkdir, rename, writeFile }, { dirname }] = await Promise.all([
      import("fs/promises"),
      import("path"),
    ]);
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(
      tmp,
      JSON.stringify({ version: 1, savedAt: new Date().toISOString(), products }, null, 2),
      "utf8",
    );
    await rename(tmp, file);
  } catch (err) {
    console.warn("product snapshot write failed", err);
  }
}

async function readProductsSnapshot(): Promise<Product[] | null> {
  const file = snapshotFile();
  if (!file) return null;
  try {
    const { readFile } = await import("fs/promises");
    const parsed = ProductSnapshot.parse(JSON.parse(await readFile(file, "utf8")));
    return parsed.products.map((p) => ({
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      price: p.price,
      oldPrice: p.oldPrice ?? undefined,
      image: p.image,
      badge: p.badge ?? undefined,
      description: p.description ?? "",
    }));
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") console.warn("product snapshot read failed", err);
    return null;
  }
}

async function restoreProductsFromSnapshot() {
  const products = await readProductsSnapshot();
  if (!products?.length) return null;
  const supabaseAdmin = await getAdminClient();

  const rows = products.map((p, index) => ({
    slug: p.slug,
    name: p.name,
    tagline: p.tagline ?? "",
    price_ore: p.price * 100,
    old_price_ore: p.oldPrice != null ? p.oldPrice * 100 : null,
    image: p.image ?? "",
    badge: p.badge ?? null,
    sort_order: index,
    description: p.description ?? "",
  }));

  const { error } = await supabaseAdmin
    .from("products")
    .upsert(rows as never, { onConflict: "slug" });
  if (error) throw new Error(error.message);
  return products;
}

async function persistCurrentProductsSnapshot() {
  try {
    const products = (await fetchProductRows()).map(rowToProduct);
    await writeProductsSnapshot(products);
  } catch (err) {
    console.warn("product snapshot refresh failed", err);
  }
}

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const products = (await fetchProductRows()).map(rowToProduct);
  if (products.length > 0) {
    await writeProductsSnapshot(products);
    return { products };
  }

  const restored = await restoreProductsFromSnapshot();
  return { products: restored ?? products };
});

export const createProduct = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => ProductInput.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdminClient();
    const { data: created, error } = await supabaseAdmin
      .from("products")
      .insert({
        slug: data.slug,
        name: data.name,
        tagline: data.tagline,
        price_ore: data.price * 100,
        old_price_ore: data.oldPrice != null ? data.oldPrice * 100 : null,
        image: data.image,
        badge: data.badge || null,
        description: data.description ?? "",
      } as never)
      .select("slug,name,tagline,price_ore,old_price_ore,image,badge,sort_order,description")
      .single();
    if (error) throw new Error(error.message);
    const product = rowToProduct(created as Row);
    await persistCurrentProductsSnapshot();
    return { ok: true, product };
  });

const UpdateInput = ProductInput.extend({ originalSlug: z.string().min(1).max(120) });

export const updateProductFn = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => UpdateInput.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdminClient();
    const { data: updated, error } = await supabaseAdmin
      .from("products")
      .update({
        slug: data.slug,
        name: data.name,
        tagline: data.tagline,
        price_ore: data.price * 100,
        old_price_ore: data.oldPrice != null ? data.oldPrice * 100 : null,
        image: data.image,
        badge: data.badge || null,
        description: data.description ?? "",
      } as never)
      .eq("slug", data.originalSlug)
      .select("slug,name,tagline,price_ore,old_price_ore,image,badge,sort_order,description")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Produkten kunde inte hittas. Ladda om sidan och försök igen.");
    const product = rowToProduct(updated as Row);
    await persistCurrentProductsSnapshot();
    return { ok: true, product };
  });

export const deleteProductFn = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdminClient();
    const { error } = await supabaseAdmin.from("products").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    await persistCurrentProductsSnapshot();
    return { ok: true };
  });

const ReorderInput = z.object({
  slugs: z.array(z.string().min(1).max(120)).min(1).max(500),
});

export const reorderProductsFn = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => ReorderInput.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdminClient();
    for (let i = 0; i < data.slugs.length; i++) {
      const { error } = await supabaseAdmin
        .from("products")
        .update({ sort_order: i } as never)
        .eq("slug", data.slugs[i]);
      if (error) throw new Error(error.message);
    }
    await persistCurrentProductsSnapshot();
    return { ok: true };
  });
