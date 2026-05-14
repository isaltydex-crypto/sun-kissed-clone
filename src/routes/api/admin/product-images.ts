/**
 * Admin endpoints for managing product images stored on the app container's
 * local disk. Provides a server-side fallback when Supabase Storage isn't
 * reachable from the browser.
 *
 *   POST   /api/admin/product-images   multipart upload (field name: "file")
 *   GET    /api/admin/product-images   list uploaded images
 *   DELETE /api/admin/product-images?name=...   delete one
 *
 * Auth: signed admin session cookie (same as the rest of the admin surface).
 */
import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { verifyAdminSession, SESSION_COOKIE } from "@/lib/admin-auth.server";
import {
  deleteProductImage,
  isAllowedContentType,
  listProductImages,
  saveProductImage,
} from "@/lib/local-uploads.server";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per image

function isAuthorized(): boolean {
  const token = getCookie(SESSION_COOKIE);
  return verifyAdminSession(token);
}

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/product-images")({
  server: {
    handlers: {
      GET: async () => {
        if (!isAuthorized()) return unauthorized();
        const images = await listProductImages();
        return Response.json({ images });
      },

      POST: async ({ request }) => {
        if (!isAuthorized()) return unauthorized();
        let form: FormData;
        try {
          form = await request.formData();
        } catch (err) {
          return Response.json(
            { error: `Kunde inte läsa uppladdningen: ${(err as Error).message}` },
            { status: 400 },
          );
        }
        const file = form.get("file");
        if (!(file instanceof File)) {
          return Response.json(
            { error: 'Förväntade fält "file" med en bild.' },
            { status: 400 },
          );
        }
        if (!isAllowedContentType(file.type)) {
          return Response.json(
            { error: "Endast bildfiler (PNG/JPEG/WebP/GIF/AVIF) tillåts." },
            { status: 400 },
          );
        }
        if (file.size > MAX_BYTES) {
          return Response.json(
            { error: `Bilden får vara högst ${MAX_BYTES / 1024 / 1024} MB.` },
            { status: 413 },
          );
        }
        const buf = new Uint8Array(await file.arrayBuffer());
        try {
          const saved = await saveProductImage(buf, file.name || "image", file.type);
          return Response.json(saved, { status: 201 });
        } catch (err) {
          return Response.json(
            { error: `Kunde inte spara bilden: ${(err as Error).message}` },
            { status: 500 },
          );
        }
      },

      DELETE: async ({ request }) => {
        if (!isAuthorized()) return unauthorized();
        const url = new URL(request.url);
        const name = url.searchParams.get("name") || "";
        const ok = await deleteProductImage(name);
        if (!ok) {
          return Response.json({ error: "Bilden kunde inte tas bort." }, { status: 400 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
