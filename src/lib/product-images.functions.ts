/**
 * Signed upload URLs for product images. The browser uploads bytes directly
 * to Supabase Storage, so the SSR worker never has to proxy multi-MB payloads
 * (which previously caused the body to be rejected and surfaced as
 * "invariant failed" on the client).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminAuthMiddleware } from "@/lib/admin-middleware";

const BUCKET = "product-images";

const Input = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z
    .string()
    .trim()
    .regex(/^image\/(png|jpeg|jpg|webp|gif|avif)$/, "Endast bildfiler tillåts."),
});

function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "bin";
  const cleanExt = ext.replace(/[^a-z0-9]+/g, "").slice(0, 5) || "bin";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${cleanExt}`;
}

function storagePublicPath(path: string): string {
  return `/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export const createProductImageUploadUrl = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }) => {
    const path = safeName(data.filename);
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) {
      throw new Error(error?.message || "Kunde inte skapa uppladdningsadress.");
    }
    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    // The server-side Supabase client may be configured with an internal URL
    // (e.g. http://kong:8000 in self-host) that the browser cannot reach.
    // Rewrite the host to the externally-reachable URL when one is provided.
    const siteBase = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
    const publicBase = (process.env.SUPABASE_PUBLIC_URL || "").replace(/\/+$/, "");
    // In self-hosted installs, Caddy proxies /storage from the current shop
    // origin. Return a relative URL so apex/www/custom-domain visitors always
    // load images from the same origin that served the page.
    let publicUrl = siteBase ? storagePublicPath(path) : pub.publicUrl;
    if (!siteBase && publicBase) {
      try {
        const u = new URL(pub.publicUrl);
        publicUrl = `${publicBase}${u.pathname}${u.search}`;
      } catch {
        // keep original
      }
    }
    return {
      bucket: BUCKET,
      path,
      token: signed.token,
      publicUrl,
    };
  });
