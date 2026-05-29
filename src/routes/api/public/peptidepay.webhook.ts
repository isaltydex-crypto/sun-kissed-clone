/**
 * POST /api/public/peptidepay/webhook
 *
 * Peptide-Pay webhook. Headern `x-peptidepay-signature` har formen
 *   t=<unix>,v1=<hex>
 * där v1 = HMAC-SHA256("<t>.<rawBody>", PEPTIDEPAY_WEBHOOK_SECRET).
 *
 * Vi avvisar:
 *  - saknad/illa-formad signatur     → 400
 *  - timestamp äldre än 5 min        → 400
 *  - ogiltig HMAC                    → 401
 *
 * Vid event "order.paid" markerar vi ordern som paid.
 * Idempotens: dedupar på session_id — vi flippar inte en order som redan är paid.
 *
 * Docs: https://peptide-pay.com/docs#webhooks
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { incrementDiscountUsage } from "@/lib/discounts.server";

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Part = parts.find((p) => p.startsWith("v1="));
  const t = tPart?.slice(2);
  const v1 = v1Part?.slice(3);
  if (!t || !v1) return false;

  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  if (v1.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/peptidepay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PEPTIDEPAY_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret not configured", { status: 503 });
        }

        const rawBody = await request.text();
        const sig = request.headers.get("x-peptidepay-signature");
        if (!verifySignature(rawBody, sig, secret)) {
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
          console.warn("[peptidepay.webhook] order not found:", orderNumber);
          // 2xx så Peptide-Pay slutar retrya
          return new Response("ok", { status: 200 });
        }

        const row = existing as {
          id: string;
          payment_status: string;
          metadata: Record<string, unknown> | null;
        };

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
          console.error("[peptidepay.webhook] order update failed:", updErr);
          return new Response("DB error", { status: 500 });
        }

        if (becomesPaid) {
          const discount = (row.metadata as { discount?: { code?: string } } | null)?.discount;
          if (discount?.code) {
            await incrementDiscountUsage(discount.code).catch((err: unknown) =>
              console.error("[peptidepay.webhook] discount counter failed:", err),
            );
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
