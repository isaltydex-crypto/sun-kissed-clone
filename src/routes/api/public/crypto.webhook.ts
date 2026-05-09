/**
 * POST /api/crypto/webhook
 *
 * NOWPayments IPN. The body is signed with HMAC-SHA512 over the JSON
 * payload with keys sorted alphabetically. The signature is in the
 * `x-nowpayments-sig` header.
 *
 * Maps the upstream payment_status onto our `orders.payment_status`:
 *   waiting / confirming / confirmed / sending / partially_paid → pending
 *   finished                                                     → paid
 *   failed / refunded / expired                                  → failed
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyNowpaymentsSignature } from "@/server/nowpayments.server";
import { incrementDiscountUsage } from "@/lib/discounts.server";

function mapStatus(s: string): "pending" | "paid" | "failed" {
  switch (s) {
    case "finished":
      return "paid";
    case "failed":
    case "refunded":
    case "expired":
      return "failed";
    default:
      return "pending";
  }
}

export const Route = createFileRoute("/api/public/crypto/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.NOWPAYMENTS_IPN_SECRET;
        if (!secret) {
          return new Response("IPN secret not configured", { status: 503 });
        }

        const rawBody = await request.text();
        const sig = request.headers.get("x-nowpayments-sig");
        if (!verifyNowpaymentsSignature(rawBody, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const orderNumber = String(payload.order_id ?? "").trim();
        const upstreamStatus = String(payload.payment_status ?? "").toLowerCase();
        if (!orderNumber || !upstreamStatus) {
          return new Response("Missing fields", { status: 400 });
        }

        const newStatus = mapStatus(upstreamStatus);

        // Find the order so we know whether this is a transition to "paid".
        const { data: existing } = await supabaseAdmin
          .from("orders")
          .select("id, payment_status, metadata")
          .eq("order_number", orderNumber)
          .maybeSingle();

        if (!existing) {
          // Acknowledge so NOWPayments doesn't keep retrying for ever, but log.
          console.warn("[crypto.webhook] order not found:", orderNumber);
          return new Response("ok", { status: 200 });
        }

        const row = existing as {
          id: string;
          payment_status: string;
          metadata: Record<string, unknown> | null;
        };

        const wasPaid = row.payment_status === "paid";
        const becomesPaid = newStatus === "paid" && !wasPaid;

        const mergedMetadata = {
          ...(row.metadata ?? {}),
          last_ipn: {
            received_at: new Date().toISOString(),
            payment_status: upstreamStatus,
            payment_id: payload.payment_id,
            pay_amount: payload.pay_amount,
            actually_paid: payload.actually_paid,
            pay_currency: payload.pay_currency,
          },
        };

        const { error: updErr } = await supabaseAdmin
          .from("orders")
          .update({
            payment_status: newStatus,
            metadata: mergedMetadata as never,
          })
          .eq("id", row.id);

        if (updErr) {
          console.error("[crypto.webhook] order update failed:", updErr);
          return new Response("DB error", { status: 500 });
        }

        if (becomesPaid) {
          const discount = (row.metadata as { discount?: { code?: string } } | null)?.discount;
          if (discount?.code) {
            await incrementDiscountUsage(discount.code).catch((err: unknown) =>
              console.error("[crypto.webhook] discount counter failed:", err),
            );
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
