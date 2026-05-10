// ============================================================================
// Server-side helper for recording diagnostic events.
// Uses the SECURITY DEFINER RPC `record_diagnostic_event` so dedupe + counter
// bumping happens atomically.
// ============================================================================
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DiagSource = "server" | "client" | "cli" | "container" | "external";
export type DiagSeverity = "info" | "warn" | "error" | "critical";

export interface DiagInput {
  source: DiagSource;
  severity: DiagSeverity;
  kind: string;
  message: string;
  stack?: string | null;
  meta?: Record<string, unknown>;
  host?: string | null;
  url?: string | null;
  userAgent?: string | null;
  /** Optional explicit fingerprint. If omitted, derived from source+kind+first 200 chars of message. */
  fingerprint?: string;
}

export function makeFingerprint(parts: (string | undefined | null)[]): string {
  const joined = parts.filter(Boolean).join("|").slice(0, 1000);
  return createHash("sha1").update(joined).digest("hex").slice(0, 32);
}

export async function recordDiagnostic(input: DiagInput): Promise<string | null> {
  const fingerprint =
    input.fingerprint ??
    makeFingerprint([input.source, input.kind, input.message.slice(0, 200)]);

  try {
    const { data, error } = await supabaseAdmin.rpc("record_diagnostic_event", {
      p_source: input.source,
      p_severity: input.severity,
      p_kind: input.kind,
      p_message: input.message.slice(0, 4000),
      p_stack: input.stack ? input.stack.slice(0, 8000) : (null as unknown as string),
      p_meta: (input.meta ?? {}) as never,
      p_host: (input.host ?? null) as unknown as string,
      p_url: (input.url ?? null) as unknown as string,
      p_user_agent: (input.userAgent ?? null) as unknown as string,
      p_fingerprint: fingerprint,
    });
    if (error) {
      console.error("[diagnostics] record failed:", error.message);
      return null;
    }
    return (data as string) ?? null;
  } catch (err) {
    console.error("[diagnostics] record threw:", err);
    return null;
  }
}
