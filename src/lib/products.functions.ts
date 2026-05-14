/**
 * Products: server-backed CRUD so the catalog is shared across all devices.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminAuthMiddleware } from "@/server/admin-middleware";
import type { Product } from "@/data/products";

type Row = {
  slug: string;
  name: string;
  tagline: string;
  price_ore: number;
  old_price_ore: number | null;
  image: string;
  badge: string | null;
  sort_order: number;
};

function rowToProduct(r: Row): Product {
  return {
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    price: Math.round(r.price_ore / 100),
    oldPrice: r.old_price_ore != null ? Math.round(r.old_price_ore / 100) : undefined,
    image: r.image,
    badge: r.badge ?? undefined,
  };
}

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("slug,name,tagline,price_ore,old_price_ore,image,badge,sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { products: (data ?? []).map((r) => rowToProduct(r as Row)) };
});

const ProductInput = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, "Slug måste vara små bokstäver, siffror och bindestreck"),
  name: z.string().trim().min(1).max(200),
  tagline: z.string().trim().max(400).default(""),
  price: z.number().int().min(0).max(10_000_000),
  oldPrice: z.number().int().min(0).max(10_000_000).optional().nullable(),
  image: z.string().max(8_000_000).default(""),
  badge: z.string().trim().max(60).optional().nullable(),
});

export const createProduct = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => ProductInput.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("products").insert({
      slug: data.slug,
      name: data.name,
      tagline: data.tagline,
      price_ore: data.price * 100,
      old_price_ore: data.oldPrice != null ? data.oldPrice * 100 : null,
      image: data.image,
      badge: data.badge || null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const UpdateInput = ProductInput.extend({ originalSlug: z.string().min(1).max(120) });

export const updateProductFn = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => UpdateInput.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("products")
      .update({
        slug: data.slug,
        name: data.name,
        tagline: data.tagline,
        price_ore: data.price * 100,
        old_price_ore: data.oldPrice != null ? data.oldPrice * 100 : null,
        image: data.image,
        badge: data.badge || null,
      } as never)
      .eq("slug", data.originalSlug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProductFn = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("products").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
