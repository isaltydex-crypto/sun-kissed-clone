// ============================================================================
// Public diagnostic ingest for browser-side errors.
// No bearer token (browsers can't safely hold one), but:
//   * Origin must match PUBLIC_SITE_URL when configured
//   * Per-IP in-memory rate limit (60 events / 5 min)
//   * Body strictly validated; severity capped at "error"
//   * Source forced to "client"
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordDiagnostic } from "@/lib/diagnostics.server";

const bodySchema = z.object({
  kind: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  stack: z.string().max(6000).optional(),
  url: z.string().max(500).optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

// Best-effort in-memory rate limit. Acceptable for a single-instance self-host
// deploy; resets on restart.
const RATE: Map<string, { count: number; reset: number }> = new Map();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_WINDOW = 60;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = RATE.get(ip);
  if (!cur || cur.reset < now) {
    RATE.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  cur.count += 1;
  return cur.count > MAX_PER_WINDOW;
}

function originAllowed(request: Request): boolean {
  const expected = process.env.PUBLIC_SITE_URL;
  if (!expected) return true; // no allowlist configured → permissive
  const origin = request.headers.get("origin") || request.headers.get("referer") || "";
  if (!origin) return false;
  try {
    const o = new URL(origin).origin;
    const e = new URL(expected).origin;
    return o === e;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/diag-client")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!originAllowed(request)) {
          return new Response("Forbidden", { status: 403 });
        }
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
          "unknown";
        if (rateLimited(ip)) {
          return new Response("Too Many Requests", { status: 429 });
        }

        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        await recordDiagnostic({
          source: "client",
          severity: "error",
          kind: parsed.kind,
          message: parsed.message,
          stack: parsed.stack,
          meta: parsed.meta,
          url: parsed.url,
          userAgent: request.headers.get("user-agent"),
          host: ip,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
