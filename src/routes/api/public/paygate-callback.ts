/**
 * GET /api/public/paygate-callback
 *
 * PayGate.to IPN. PayGate sends a GET request that replays every query
 * parameter from the callback URL we provided, plus `value_coin` (the actual
 * USDC amount received on the temporary Polygon address).
 *
 * Security: PayGate does NOT sign the callback. We protect it by embedding
 * an unguessable token `t=<PAYGATE_CALLBACK_SECRET>` in the callback URL when
 * the wallet is created and verifying it here with a constant-time compare.
 *
 * Idempotent: receiving the same paid event twice has no side effects.
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { incrementDiscountUsage } from "@/lib/discounts.server";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  try {
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.PAYGATE_CALLBACK_SECRET;
  if (!secret) {
    return new Response("Callback secret not configured", { status: 503 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const orderNumber = (url.searchParams.get("order") ?? "").trim();
  const valueCoin = url.searchParams.get("value_coin");

  if (!safeEqual(token, secret)) {
    return new Response("Invalid token", { status: 401 });
  }
  if (!orderNumber) {
    return new Response("Missing order", { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id, payment_status, metadata")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!existing) {
    console.warn("[paygate-callback] order not found:", orderNumber);
    return new Response("ok", { status: 200 });
  }

  const row = existing as {
    id: string;
    payment_status: string;
    metadata: Record<string, unknown> | null;
  };

  const wasPaid = row.payment_status === "paid";
  // PayGate hits the callback once the customer payment has been received in
  // USDC on the temporary wallet. The presence of `value_coin` is the signal.
  const becomesPaid = !wasPaid && valueCoin !== null && valueCoin !== "";

  const mergedMetadata = {
    ...(row.metadata ?? {}),
    last_callback: {
      received_at: new Date().toISOString(),
      value_coin: valueCoin,
      query: Object.fromEntries(url.searchParams.entries()),
    },
  };

  const newStatus = becomesPaid ? "paid" : row.payment_status;

  const { error: updErr } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: newStatus,
      metadata: mergedMetadata as never,
    })
    .eq("id", row.id);

  if (updErr) {
    console.error("[paygate-callback] order update failed:", updErr);
    return new Response("DB error", { status: 500 });
  }

  if (becomesPaid) {
    const discount = (row.metadata as { discount?: { code?: string } } | null)?.discount;
    if (discount?.code) {
      await incrementDiscountUsage(discount.code).catch((err: unknown) =>
        console.error("[paygate-callback] discount counter failed:", err),
      );
    }
  }

  return new Response("ok", { status: 200 });
}

export const Route = createFileRoute("/api/public/paygate-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
