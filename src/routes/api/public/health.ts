import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public health endpoint for uptime monitors (UptimeRobot, BetterStack, etc.).
// Returns 200 OK only when the database is reachable. No auth required.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        try {
          const { error } = await supabaseAdmin
            .from("site_pages")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) throw error;
        } catch (err) {
          return Response.json(
            {
              ok: false,
              checks: { db: "down" },
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
        return Response.json(
          {
            ok: true,
            checks: { db: "up" },
            latency_ms: Date.now() - started,
            timestamp: new Date().toISOString(),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
