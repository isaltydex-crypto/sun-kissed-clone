/**
 * POST /api/public/nowpayments/webhook
 *
 * NOWPayments IPN callback. The body is signed with HMAC-SHA512 over a
 * deterministic (alphabetically-sorted-keys) JSON of the payload, using
 * the IPN secret. Header: `x-nowpayments-sig`.
 *
 * Docs: https://nowpayments.io/help/article/how-to-verify-ipn-callback-signature
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  mapNowPaymentsStatus,
  verifyNowPaymentsSignature,
} from "@/server/nowpayments.server";
import { incrementDiscountUsage } from "@/lib/discounts.server";

export const Route = createFileRoute("/api/public/nowpayments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.NOWPAYMENTS_IPN_SECRET;
        if (!secret) return new Response("IPN secret not configured", { status: 503 });

        const rawBody = await request.text();
        const sig = request.headers.get("x-nowpayments-sig");
        if (!verifyNowPaymentsSignature(rawBody, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const orderNumber = String(payload.order_id ?? "").trim();
        const upstreamStatus = String(payload.payment_status ?? "").trim();
        if (!orderNumber || !upstreamStatus) {
          return new Response("Missing fields", { status: 400 });
        }

        const newStatus = mapNowPaymentsStatus(upstreamStatus);

        const { data: existing } = await supabaseAdmin
          .from("orders")
          .select("id, payment_status, metadata")
          .eq("order_number", orderNumber)
          .maybeSingle();

        if (!existing) {
          console.warn("[nowpayments.webhook] order not found:", orderNumber);
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
            provider: "nowpayments",
            payment_status: upstreamStatus,
            payment_id: payload.payment_id ?? null,
            pay_currency: payload.pay_currency ?? null,
            actually_paid: payload.actually_paid ?? null,
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
          console.error("[nowpayments.webhook] order update failed:", updErr);
          return new Response("DB error", { status: 500 });
        }

        if (becomesPaid) {
          const discount = (row.metadata as { discount?: { code?: string } } | null)?.discount;
          if (discount?.code) {
            await incrementDiscountUsage(discount.code).catch((err: unknown) =>
              console.error("[nowpayments.webhook] discount counter failed:", err),
            );
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
