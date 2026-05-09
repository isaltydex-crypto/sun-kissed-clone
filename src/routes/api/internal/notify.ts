// ============================================================================
// Internal endpoint for sending operational alerts (backup failures, etc.)
// from other containers in the stack. Protected by a shared bearer token.
//
//   POST /api/internal/notify
//   Authorization: Bearer ${INTERNAL_NOTIFY_TOKEN}
//   { kind: "alert", vars: { job, host, startedAt, failedAt, exitCode, log } }
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { sendNotification } from "@/lib/notify.server";
import { renderEmail } from "@/lib/email-templates";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mergeContent, type SiteContentMap } from "@/lib/site-defaults";

const bodySchema = z.object({
  kind: z.literal("alert"),
  vars: z.record(z.string(), z.string()).default({}),
});

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const Route = createFileRoute("/api/internal/notify")({
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

        const { data } = await supabaseAdmin.from("site_content").select("key,value");
        const stored: SiteContentMap = {};
        for (const row of data ?? []) {
          (stored as Record<string, unknown>)[row.key] = row.value as unknown;
        }
        const templates = mergeContent(stored).emails;

        const rendered = renderEmail(templates, "alert", {
          job: parsed.vars.job ?? "(okänt jobb)",
          host: parsed.vars.host ?? "(okänd server)",
          startedAt: parsed.vars.startedAt ?? "",
          failedAt: parsed.vars.failedAt ?? new Date().toISOString(),
          exitCode: parsed.vars.exitCode ?? "?",
          log: parsed.vars.log ?? "(ingen logg)",
        });

        const sent = await sendNotification({
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        });

        return Response.json({ ok: true, emailed: sent });
      },
    },
  },
});
