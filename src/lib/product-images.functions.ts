/**
 * Signed upload URLs for product images. The browser uploads bytes directly
 * to Supabase Storage, so the SSR worker never has to proxy multi-MB payloads
 * (which previously caused the body to be rejected and surfaced as
 * "invariant failed" on the client).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminAuthMiddleware } from "@/server/admin-middleware";

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

export const createProductImageUploadUrl = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }) => {
    const path = safeName(data.filename);
    const { data: signed, error } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) {
      throw new Error(error?.message || "Kunde inte skapa uppladdningsadress.");
    }
    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return {
      bucket: BUCKET,
      path,
      token: signed.token,
      publicUrl: pub.publicUrl,
    };
  });
