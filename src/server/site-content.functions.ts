import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mergeContent, type SiteContentMap, type SiteDefaults } from "@/lib/site-defaults";

function requireAdmin() {
  const fromHeader = getRequestHeader("x-admin-password") || "";
  const fromCookie = getCookie("pvl_admin") || "";
  const provided = fromHeader || fromCookie;
  const expected = process.env.ADMIN_CHAT_PASSWORD || "peptiva-admin-2026";
  if (!provided || provided !== expected) {
    throw new Response("Unauthorized", { status: 401 });
  }
}

export type CustomPage = {
  id: string;
  slug: string;
  title: string;
  body: string;
  in_menu: boolean;
  menu_label: string | null;
  menu_order: number;
  published: boolean;
  meta_description: string | null;
};

// ---------- Public reads ----------

export const fetchSiteBundle = createServerFn({ method: "GET" }).handler(async () => {
  const [contentRes, pagesRes] = await Promise.all([
    supabaseAdmin.from("site_content").select("key,value"),
    supabaseAdmin
      .from("site_pages")
      .select("id,slug,title,body,in_menu,menu_label,menu_order,published,meta_description")
      .eq("published", true)
      .order("menu_order", { ascending: true }),
  ]);

  const stored: SiteContentMap = {};
  for (const row of contentRes.data ?? []) {
    (stored as Record<string, unknown>)[row.key] = row.value as unknown;
  }
  const content: SiteDefaults = mergeContent(stored);
  const pages = (pagesRes.data ?? []) as CustomPage[];
  return { content, pages };
});

export const fetchCustomPage = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("site_pages")
      .select("*")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { page: (row as CustomPage | null) ?? null };
  });

// ---------- Admin reads ----------

export const adminFetchAll = createServerFn({ method: "POST" }).handler(async () => {
  requireAdmin();
  const [contentRes, pagesRes] = await Promise.all([
    supabaseAdmin.from("site_content").select("key,value"),
    supabaseAdmin.from("site_pages").select("*").order("menu_order", { ascending: true }),
  ]);
  const stored: SiteContentMap = {};
  for (const row of contentRes.data ?? []) {
    (stored as Record<string, unknown>)[row.key] = row.value as unknown;
  }
  return {
    rawContent: stored,
    merged: mergeContent(stored),
    pages: (pagesRes.data ?? []) as CustomPage[],
  };
});

// ---------- Admin writes ----------

export const adminSaveSection = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        key: z.string().min(1).max(60),
        value: z.unknown(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin();
    const { error } = await supabaseAdmin
      .from("site_content")
      .upsert({ key: data.key, value: data.value as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Endast små bokstäver, siffror och bindestreck");

export const adminUpsertPage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: slugSchema,
        title: z.string().min(1).max(160),
        body: z.string().max(50_000).default(""),
        in_menu: z.boolean().default(false),
        menu_label: z.string().max(60).nullable().optional(),
        menu_order: z.number().int().min(0).max(9999).default(100),
        published: z.boolean().default(true),
        meta_description: z.string().max(300).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    requireAdmin();
    const payload = {
      slug: data.slug,
      title: data.title,
      body: data.body,
      in_menu: data.in_menu,
      menu_label: data.menu_label ?? null,
      menu_order: data.menu_order,
      published: data.published,
      meta_description: data.meta_description ?? null,
    };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("site_pages")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { page: row as CustomPage };
    }
    const { data: row, error } = await supabaseAdmin
      .from("site_pages")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { page: row as CustomPage };
  });

export const adminDeletePage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin();
    const { error } = await supabaseAdmin.from("site_pages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
