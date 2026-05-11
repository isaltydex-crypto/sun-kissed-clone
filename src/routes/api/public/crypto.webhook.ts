/**
 * POST /api/public/crypto/webhook
 *
 * Paymento IPN. The body is signed with HMAC-SHA256 over the raw JSON payload
 * using the merchant secret key. The UPPERCASE hex signature is sent in the
 * `X-Hmac-Sha256-Signature` header.
 *
 * Docs: https://docs.paymento.io/api-documention/payment-callback
 *
 * Maps Paymento OrderStatus onto our `orders.payment_status`:
 *   0 Initialize / 1 Pending / 2 PartialPaid / 3 WaitingToConfirm → pending
 *   7 Paid / 8 Approve                                            → paid
 *   4 Timeout / 5 UserCanceled / 9 Reject                         → failed
 *
 * After a "Paid" status we additionally call /v1/payment/verify to confirm
 * the transaction with Paymento before flipping the order to paid.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapPaymentoStatus, verifyPaymentoSignature } from "@/server/paymento.server";
import { incrementDiscountUsage } from "@/lib/discounts.server";

async function paymentoVerify(token: string): Promise<boolean> {
  const apiKey = process.env.PAYMENTO_API_KEY;
  if (!apiKey) return false;
  const baseUrl =
    process.env.PAYMENTO_BASE_URL?.replace(/\/$/, "") ?? "https://api.paymento.io/v1";
  try {
    const res = await fetch(`${baseUrl}/payment/verify`, {
      method: "POST",
      headers: {
        "Api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "text/plain",
      },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json.success);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/crypto/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYMENTO_HMAC_SECRET;
        if (!secret) {
          return new Response("HMAC secret not configured", { status: 503 });
        }

        const rawBody = await request.text();
        // Header name is case-insensitive; Paymento documents both spellings.
        const sig =
          request.headers.get("x-hmac-sha256-signature") ??
          request.headers.get("hmac_sha256_signature");
        if (!verifyPaymentoSignature(rawBody, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const orderNumber = String(payload.OrderId ?? payload.orderId ?? "").trim();
        const upstreamStatus = Number(payload.OrderStatus ?? payload.orderStatus ?? -1);
        const token = String(payload.Token ?? payload.token ?? "").trim();
        if (!orderNumber || Number.isNaN(upstreamStatus) || upstreamStatus < 0) {
          return new Response("Missing fields", { status: 400 });
        }

        let newStatus = mapPaymentoStatus(upstreamStatus);

        // Always re-verify a "paid" callback against Paymento before crediting.
        if (newStatus === "paid") {
          const ok = token ? await paymentoVerify(token) : false;
          if (!ok) {
            console.warn("[crypto.webhook] verify failed for", orderNumber, "token=", token);
            newStatus = "pending";
          }
        }

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
            order_status: upstreamStatus,
            payment_id: payload.PaymentId ?? payload.paymentId ?? null,
            token: token || null,
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
