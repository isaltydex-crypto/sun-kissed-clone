/**
 * Public read-only serving of locally-stored product images.
 * Files live under UPLOADS_DIR/products/ on the app container.
 *
 * GET /api/public/uploads/products/<filename>
 */
import { createFileRoute } from "@tanstack/react-router";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import {
  contentTypeFor,
  PRODUCTS_SUBDIR,
  productsDir,
  sanitizeFilename,
} from "@/lib/local-uploads.server";

export const Route = createFileRoute("/api/public/uploads/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const splat = (params as { _splat?: string })._splat || "";
        const parts = splat.split("/").filter(Boolean);
        // Only /products/<name> is allowed.
        if (parts.length !== 2 || parts[0] !== PRODUCTS_SUBDIR) {
          return new Response("Not found", { status: 404 });
        }
        const safe = sanitizeFilename(parts[1]);
        if (!safe) return new Response("Not found", { status: 404 });
        const path = join(productsDir(), safe);
        try {
          const s = await stat(path);
          if (!s.isFile()) return new Response("Not found", { status: 404 });
          const bytes = await readFile(path);
          return new Response(bytes, {
            status: 200,
            headers: {
              "Content-Type": contentTypeFor(safe),
              "Content-Length": String(s.size),
              "Cache-Control": "public, max-age=31536000, immutable",
              "Cross-Origin-Resource-Policy": "cross-origin",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
