/**
 * POST /api/public/nowpayments-webhook
 *
 * NOWPayments IPN. Header `x-nowpayments-sig` = HMAC-SHA512 hex av
 * JSON.stringify av sorterad payload, med NOWPAYMENTS_IPN_SECRET.
 *
 * Hard rules:
 *  - Verifiera signatur INNAN vi förändrar någon state.
 *  - Idempotent: dedupe på order_id; flippa aldrig en redan paid order.
 *  - Returnera 200 snabbt; NOWPayments retry:ar vid non-2xx.
 *
 * Docs: https://documenter.getpostman.com/view/7907941/2s93JusNJt
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { incrementDiscountUsage } from "@/lib/discounts.server";
import { mapNowPaymentsStatus, verifyNowPaymentsSignature } from "@/lib/nowpayments.server";

export const Route = createFileRoute("/api/public/nowpayments-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.NOWPAYMENTS_IPN_SECRET;
        if (!secret) {
          return new Response("Webhook secret not configured", { status: 503 });
        }

        const rawBody = await request.text();
        const sig = request.headers.get("x-nowpayments-sig");

        if (!verifyNowPaymentsSignature(rawBody, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: {
          payment_id?: string | number;
          payment_status?: string;
          order_id?: string;
          price_amount?: number;
          price_currency?: string;
          pay_amount?: number;
          pay_currency?: string;
          actually_paid?: number;
          outcome_amount?: number;
          outcome_currency?: string;
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
          console.warn("[nowpayments-webhook] order not found:", orderNumber);
          return new Response("ok", { status: 200 });
        }

        const row = existing as {
          id: string;
          payment_status: string;
          metadata: Record<string, unknown> | null;
        };

        const wasPaid = row.payment_status === "paid";
        const mapped = mapNowPaymentsStatus(event.payment_status);
        const becomesPaid = mapped === "paid" && !wasPaid;

        const mergedMetadata = {
          ...(row.metadata ?? {}),
          last_webhook: {
            received_at: new Date().toISOString(),
            payment_id: event.payment_id ?? null,
            payment_status: event.payment_status ?? null,
            pay_amount: event.pay_amount ?? null,
            pay_currency: event.pay_currency ?? null,
            actually_paid: event.actually_paid ?? null,
            outcome_amount: event.outcome_amount ?? null,
            outcome_currency: event.outcome_currency ?? null,
          },
        };

        // Aldrig flippa en redan paid order tillbaka.
        const newStatus = wasPaid ? "paid" : mapped;

        const { error: updErr } = await supabaseAdmin
          .from("orders")
          .update({
            payment_status: newStatus,
            metadata: mergedMetadata as never,
          })
          .eq("id", row.id);

        if (updErr) {
          console.error("[nowpayments-webhook] order update failed:", updErr);
          return new Response("DB error", { status: 500 });
        }

        if (becomesPaid) {
          const discount = (row.metadata as { discount?: { code?: string } } | null)?.discount;
          if (discount?.code) {
            await incrementDiscountUsage(discount.code).catch((err: unknown) =>
              console.error("[nowpayments-webhook] discount counter failed:", err),
            );
          }

          // Notifiera admin när NOWPayments-order är betald.
          // Mottagare: NOWPAYMENTS_NOTIFY_TO (specifik adress) eller NOTIFY_EMAIL_TO som fallback.
          try {
            const { sendNotification } = await import("@/lib/notify.server");
            const to = process.env.NOWPAYMENTS_NOTIFY_TO || process.env.NOTIFY_EMAIL_TO;
            const amount = event.price_amount ?? "";
            const currency = (event.price_currency ?? "").toUpperCase();
            const payAmount = event.actually_paid ?? event.pay_amount ?? "";
            const payCurrency = (event.pay_currency ?? "").toUpperCase();
            const subject = `NOWPayments: betald order ${orderNumber}`;
            const text = [
              `Order ${orderNumber} är betald via NOWPayments.`,
              ``,
              `Belopp: ${amount} ${currency}`,
              `Mottaget: ${payAmount} ${payCurrency}`,
              `Payment ID: ${event.payment_id ?? "-"}`,
              `Status: ${event.payment_status ?? "-"}`,
            ].join("\n");
            await sendNotification({ to, subject, text });
          } catch (err) {
            console.error("[nowpayments-webhook] notify email failed:", err);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
