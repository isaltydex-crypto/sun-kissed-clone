// ============================================================================
// Internal diagnostic ingest. Used by the self-host CLI and sibling containers
// to report container/external-service issues. Token-protected.
//
//   POST /api/internal/diag
//   Authorization: Bearer ${INTERNAL_NOTIFY_TOKEN}
//   { source, severity, kind, message, stack?, meta?, host? }
//
// Critical events also fire an email alert via /api/internal/notify pipeline.
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { recordDiagnostic } from "@/lib/diagnostics.server";
import { sendNotification } from "@/lib/notify.server";

const bodySchema = z.object({
  source: z.enum(["server", "client", "cli", "container", "external"]),
  severity: z.enum(["info", "warn", "error", "critical"]),
  kind: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
  stack: z.string().max(8000).optional(),
  meta: z.record(z.string(), z.any()).optional(),
  host: z.string().max(200).optional(),
});

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const Route = createFileRoute("/api/internal/diag")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.INTERNAL_NOTIFY_TOKEN || "";
        if (!expected) {
          return new Response("INTERNAL_NOTIFY_TOKEN not configured", { status: 503 });
        }
        const auth = request.headers.get("authorization") || "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token || !safeEq(token, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch (err) {
          return new Response(`Bad request: ${(err as Error).message}`, { status: 400 });
        }

        const id = await recordDiagnostic({
          source: parsed.source,
          severity: parsed.severity,
          kind: parsed.kind,
          message: parsed.message,
          stack: parsed.stack,
          meta: parsed.meta,
          host: parsed.host,
        });

        // Critical events get an email alert (best-effort).
        if (parsed.severity === "critical") {
          await sendNotification({
            subject: `[Diagnostik] ${parsed.kind} på ${parsed.host ?? "okänd värd"}`,
            text: `${parsed.message}\n\n${parsed.stack ?? ""}`,
          }).catch(() => false);
        }

        return Response.json({ ok: true, id });
      },
    },
  },
});
