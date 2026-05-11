/**
 * POST /api/crypto/create-invoice
 *
 * Called by the storefront checkout. Persists the order as `pending`,
 * creates a Paymento payment request, and returns the hosted gateway URL.
 *
 * Required env on the server:
 *   PAYMENTO_API_KEY     — merchant API key from app.paymento.io
 *   PAYMENTO_BASE_URL    — defaults to https://api.paymento.io/v1
 *   PAYMENTO_SPEED       — 0 = High (mempool), 1 = Low (confirmed). Default 1.
 *   CRYPTO_SUCCESS_URL   — optional override of body.successUrl (used as ReturnUrl)
 *   CRYPTO_CANCEL_URL    — optional override of body.cancelUrl (informational only)
 *
 * The IPN URL is configured per-merchant in the Paymento dashboard
 * ("Set Payment Settings"). Point it at:
 *   https://<your-domain>/api/public/crypto/webhook
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateDiscountForSubtotal } from "@/lib/discounts.server";

const SHIPPING_FREE_OVER_ORE = 49900;
const SHIPPING_COST_ORE = 4900;

const ItemSchema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(300),
  price: z.number().min(0),
  quantity: z.number().int().min(1).max(999),
});

const BodySchema = z.object({
  orderId: z.string().min(3).max(80),
  amount: z.number().min(0),
  currency: z.string().length(3).default("SEK"),
  // Kept for UI compatibility; Paymento lets the buyer pick the coin on the
  // hosted gateway, so we only forward it as additionalData metadata.
  payCurrency: z.enum(["btc", "eth", "usdc", "usdt"]).optional(),
  customer: z.object({
    email: z.string().email().max(255),
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    address: z.string().min(1).max(200),
    postalCode: z.string().min(1).max(20),
    city: z.string().min(1).max(80),
    phone: z.string().min(3).max(40),
    notes: z.string().max(1000).optional(),
  }),
  items: z.array(ItemSchema).min(1).max(50),
  discountCode: z.string().trim().max(40).optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const PAYMENTO_GATEWAY_URL = "https://app.paymento.io/gateway";

export const Route = createFileRoute("/api/crypto/create-invoice")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let parsed: z.infer<typeof BodySchema>;
        try {
          parsed = BodySchema.parse(await request.json());
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Bad request" },
            { status: 400, headers: corsHeaders },
          );
        }

        const apiKey = process.env.PAYMENTO_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "Crypto payments are not configured on this server." },
            { status: 503, headers: corsHeaders },
          );
        }
        const baseUrl =
          process.env.PAYMENTO_BASE_URL?.replace(/\/$/, "") ??
          "https://api.paymento.io/v1";
        const speed = Number(process.env.PAYMENTO_SPEED ?? "1");

        // Recompute totals server-side from the line items (in öre).
        const subtotalOre = parsed.items.reduce(
          (sum, i) => sum + Math.round(i.price * 100) * i.quantity,
          0,
        );
        const shippingOre =
          subtotalOre === 0 ? 0 : subtotalOre >= SHIPPING_FREE_OVER_ORE ? 0 : SHIPPING_COST_ORE;

        let discountOre = 0;
        let discountInfo:
          | { code: string; type: "percent" | "fixed"; value: number; amount: number; description?: string }
          | null = null;
        if (parsed.discountCode) {
          const result = await validateDiscountForSubtotal(parsed.discountCode, subtotalOre);
          if (result.ok) {
            discountOre = result.discount.amount;
            discountInfo = result.discount;
          }
        }

        const totalOre = Math.max(0, subtotalOre + shippingOre - discountOre);
        const totalSek = totalOre / 100;

        // Persist the order (pending). order_number = parsed.orderId so the
        // IPN webhook can find it via Paymento's OrderId field.
        const { data: orderRow, error: orderErr } = await supabaseAdmin
          .from("orders")
          .insert({
            order_number: parsed.orderId,
            customer_email: parsed.customer.email,
            customer_name: `${parsed.customer.firstName} ${parsed.customer.lastName}`.trim(),
            customer_phone: parsed.customer.phone,
            shipping_address: {
              address: parsed.customer.address,
              postal_code: parsed.customer.postalCode,
              city: parsed.customer.city,
              notes: parsed.customer.notes ?? null,
            } as never,
            subtotal_ore: subtotalOre,
            shipping_ore: shippingOre,
            discount_ore: discountOre,
            total_ore: totalOre,
            currency: parsed.currency,
            payment_method: parsed.payCurrency ? `crypto:${parsed.payCurrency}` : "crypto",
            payment_status: "pending",
            metadata: {
              discount: discountInfo,
              pay_currency: parsed.payCurrency ?? null,
              provider: "paymento",
            } as never,
          })
          .select("id")
          .single();

        if (orderErr || !orderRow) {
          console.error("[crypto.create-invoice] order insert failed", {
            err: orderErr,
            orderId: parsed.orderId,
          });
          const detail = orderErr
            ? [orderErr.message, orderErr.code, orderErr.details, orderErr.hint]
                .filter(Boolean)
                .join(" | ")
            : "no row returned";
          return Response.json(
            { error: `Could not create order: ${detail}` },
            { status: 500, headers: corsHeaders },
          );
        }

        const itemRows = parsed.items.map((i) => ({
          order_id: (orderRow as { id: string }).id,
          product_id: i.slug,
          product_name: i.name,
          unit_price_ore: Math.round(i.price * 100),
          quantity: i.quantity,
          line_total_ore: Math.round(i.price * 100) * i.quantity,
        }));
        await supabaseAdmin.from("order_items").insert(itemRows);

        // Create the payment request at Paymento.
        // https://docs.paymento.io/api-documention/payment-request
        let token: string;
        try {
          const res = await fetch(`${baseUrl}/payment/request`, {
            method: "POST",
            headers: {
              "Api-key": apiKey,
              "Content-Type": "application/json",
              Accept: "text/plain",
            },
            body: JSON.stringify({
              fiatAmount: totalSek.toFixed(2),
              fiatCurrency: parsed.currency.toUpperCase(),
              ReturnUrl: process.env.CRYPTO_SUCCESS_URL || parsed.successUrl,
              orderId: parsed.orderId,
              Speed: Number.isFinite(speed) ? speed : 1,
              EmailAddress: parsed.customer.email,
              additionalData: [
                { key: "order_number", value: parsed.orderId },
                ...(parsed.payCurrency
                  ? [{ key: "preferred_coin", value: parsed.payCurrency }]
                  : []),
              ],
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return Response.json(
              { error: `Paymento error (${res.status}): ${text}` },
              { status: 502, headers: corsHeaders },
            );
          }
          const json = (await res.json()) as {
            success: boolean;
            message?: string;
            body?: string;
          };
          if (!json.success || !json.body) {
            return Response.json(
              { error: `Paymento rejected request: ${json.message || "unknown"}` },
              { status: 502, headers: corsHeaders },
            );
          }
          token = String(json.body).trim();
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Paymento request failed" },
            { status: 502, headers: corsHeaders },
          );
        }

        const invoiceUrl = `${PAYMENTO_GATEWAY_URL}?token=${encodeURIComponent(token)}`;

        // Store the Paymento token on the order so we can correlate later.
        await supabaseAdmin
          .from("orders")
          .update({
            metadata: {
              discount: discountInfo,
              pay_currency: parsed.payCurrency ?? null,
              provider: "paymento",
              paymento_token: token,
            } as never,
          })
          .eq("id", (orderRow as { id: string }).id);

        return Response.json(
          {
            invoiceUrl,
            invoiceId: token,
            totals: {
              subtotal: subtotalOre / 100,
              shipping: shippingOre / 100,
              discount: discountInfo
                ? { ...discountInfo, amount: discountInfo.amount / 100 }
                : null,
              total: totalSek,
            },
          },
          { headers: corsHeaders },
        );
      },
    },
  },
});
