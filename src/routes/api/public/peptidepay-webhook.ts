/**
 * POST /api/public/peptidepay-webhook
 *
 * Peptide-Pay IPN. Header `x-peptidepay-signature` = `t=<unix>,v1=<hex>` where
 * v1 = HMAC-SHA256("<t>.<rawBody>", PEPTIDEPAY_WEBHOOK_SECRET).
 *
 * Hard rules:
 *  - Read RAW body BEFORE parsing JSON (HMAC is over the exact bytes).
 *  - Timing-safe compare (handled by verifyPeptidePaySignature).
 *  - Idempotent: dedupe on session_id; never flip an already-paid order.
 *  - Return 200 fast; Peptide-Pay retries 6× over ~42h on non-2xx.
 *
 * Docs: https://peptide-pay.com/docs#webhooks
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { incrementDiscountUsage } from "@/lib/discounts.server";
import { verifyPeptidePaySignature } from "@/lib/peptidepay.server";

export const Route = createFileRoute("/api/public/peptidepay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PEPTIDEPAY_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret not configured", { status: 503 });
        }

        // 1. RAW body BEFORE any JSON parser touches it.
        const rawBody = await request.text();
        const sig = request.headers.get("x-peptidepay-signature");

        // 2-6. Timestamp + timing-safe HMAC.
        if (!verifyPeptidePaySignature(rawBody, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: {
          event?: string;
          session_id?: string;
          order_id?: string;
          status?: string;
          amount?: number;
          currency?: string;
          txid?: string;
          paid_at?: string;
          attempt?: number;
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const orderNumber = String(event.order_id ?? "").trim();
        if (!orderNumber) {
          return new Response("Missing order_id", { status: 400 });
        }

        const { data: existing } = await supabaseAdmin
          .from("orders")
          .select("id, payment_status, metadata")
          .eq("order_number", orderNumber)
          .maybeSingle();

        if (!existing) {
          console.warn("[peptidepay-webhook] order not found:", orderNumber);
          return new Response("ok", { status: 200 });
        }

        const row = existing as {
          id: string;
          payment_status: string;
          metadata: Record<string, unknown> | null;
        };

        // Idempotent: receiving the same paid event twice has no side effects.
        const wasPaid = row.payment_status === "paid";
        const becomesPaid = event.event === "order.paid" && !wasPaid;

        const mergedMetadata = {
          ...(row.metadata ?? {}),
          last_webhook: {
            received_at: new Date().toISOString(),
            event: event.event ?? null,
            session_id: event.session_id ?? null,
            txid: event.txid ?? null,
            paid_at: event.paid_at ?? null,
            attempt: event.attempt ?? null,
          },
        };

        const newStatus = event.event === "order.paid" ? "paid" : row.payment_status;

        const { error: updErr } = await supabaseAdmin
          .from("orders")
          .update({
            payment_status: newStatus,
            metadata: mergedMetadata as never,
          })
          .eq("id", row.id);

        if (updErr) {
          console.error("[peptidepay-webhook] order update failed:", updErr);
          return new Response("DB error", { status: 500 });
        }

        if (becomesPaid) {
          const discount = (row.metadata as { discount?: { code?: string } } | null)?.discount;
          if (discount?.code) {
            await incrementDiscountUsage(discount.code).catch((err: unknown) =>
              console.error("[peptidepay-webhook] discount counter failed:", err),
            );
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
