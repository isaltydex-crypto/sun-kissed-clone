// ============================================================================
// Admin server functions for the diagnostic dashboard.
// All gated by adminAuthMiddleware (signed cookie session).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminAuthMiddleware } from "@/lib/admin-middleware";

const ListSchema = z.object({
  source: z.enum(["server", "client", "cli", "container", "external"]).optional(),
  severity: z.enum(["info", "warn", "error", "critical"]).optional(),
  resolved: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).default(200),
});

export const listDiagnostics = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => ListSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("diagnostic_events")
      .select(
        "id,source,severity,kind,message,stack,meta,host,url,user_agent,fingerprint,occurrence_count,resolved,resolved_at,resolved_note,created_at,last_seen_at",
      )
      .order("last_seen_at", { ascending: false })
      .limit(data.limit);

    if (data.source) q = q.eq("source", data.source);
    if (data.severity) q = q.eq("severity", data.severity);
    if (typeof data.resolved === "boolean") q = q.eq("resolved", data.resolved);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Summary counts (unresolved only)
    const { data: counts } = await supabaseAdmin
      .from("diagnostic_events")
      .select("severity")
      .eq("resolved", false);
    const summary = { info: 0, warn: 0, error: 0, critical: 0, total: rows?.length ?? 0 };
    for (const r of counts ?? []) {
      const k = (r as { severity: keyof typeof summary }).severity;
      if (k in summary) summary[k] += 1;
    }
    return { events: rows ?? [], summary };
  });

const ResolveSchema = z.object({
  id: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export const resolveDiagnostic = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => ResolveSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("diagnostic_events")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_note: data.note ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const FingerprintSchema = z.object({ fingerprint: z.string().min(1).max(64) });

export const resolveByFingerprint = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => FingerprintSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("diagnostic_events")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("fingerprint", data.fingerprint)
      .eq("resolved", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
