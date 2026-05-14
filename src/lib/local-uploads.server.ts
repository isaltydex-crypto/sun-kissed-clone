/**
 * Server-only helpers for storing product images directly on the app
 * container's disk. Used as a fallback when Supabase Storage isn't reachable
 * (e.g. self-host install where /storage/* proxying is misconfigured).
 *
 * Files live under UPLOADS_DIR/products/ and are served publicly via
 * GET /api/public/uploads/products/:name.
 */
import { mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import { join, basename } from "path";

export const UPLOADS_DIR = process.env.LOCAL_UPLOADS_DIR || "/var/lib/peptiva/uploads";
export const PRODUCTS_SUBDIR = "products";

const ALLOWED = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export function contentTypeFor(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  return EXT_TO_MIME[ext] || "application/octet-stream";
}

export function safeName(originalName: string, contentType: string): string {
  const ext =
    ALLOWED.get(contentType.toLowerCase()) ||
    (originalName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "bin");
  const cleanExt = ext.replace(/[^a-z0-9]+/g, "").slice(0, 5) || "bin";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${cleanExt}`;
}

export function isAllowedContentType(ct: string): boolean {
  return ALLOWED.has(ct.toLowerCase());
}

export function productsDir(): string {
  return join(UPLOADS_DIR, PRODUCTS_SUBDIR);
}

/** Sanitize a filename to prevent path traversal. */
export function sanitizeFilename(name: string): string | null {
  const b = basename(name);
  if (!b || b === "." || b === "..") return null;
  if (!/^[A-Za-z0-9._-]+$/.test(b)) return null;
  return b;
}

export async function saveProductImage(
  bytes: Uint8Array,
  originalName: string,
  contentType: string,
): Promise<{ name: string; url: string }> {
  const dir = productsDir();
  await mkdir(dir, { recursive: true });
  const name = safeName(originalName, contentType);
  await writeFile(join(dir, name), bytes);
  return { name, url: `/api/public/uploads/products/${name}` };
}

export async function listProductImages(): Promise<
  { name: string; url: string; size: number; mtime: number }[]
> {
  const dir = productsDir();
  try {
    await mkdir(dir, { recursive: true });
    const entries = await readdir(dir);
    const out: { name: string; url: string; size: number; mtime: number }[] = [];
    for (const e of entries) {
      const safe = sanitizeFilename(e);
      if (!safe) continue;
      try {
        const s = await stat(join(dir, safe));
        if (!s.isFile()) continue;
        out.push({
          name: safe,
          url: `/api/public/uploads/products/${safe}`,
          size: s.size,
          mtime: s.mtimeMs,
        });
      } catch {
        /* skip */
      }
    }
    out.sort((a, b) => b.mtime - a.mtime);
    return out;
  } catch {
    return [];
  }
}

export async function deleteProductImage(name: string): Promise<boolean> {
  const safe = sanitizeFilename(name);
  if (!safe) return false;
  try {
    await unlink(join(productsDir(), safe));
    return true;
  } catch {
    return false;
  }
}
