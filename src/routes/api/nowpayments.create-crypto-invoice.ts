/**
 * POST /api/nowpayments/create-crypto-invoice
 *
 * Skapar en hosted NOWPayments-invoice för krypto-betalning. Buyer redirectas
 * till `invoice_url` och NOWPayments POST:ar IPN till webhooken vid betalning.
 *
 * Den befintliga `/api/nowpayments/create-invoice` är låst till kort-rails
 * (google_pay/apple_pay/samsung_pay). Det här är crypto-varianten som mappar
 * vår enkla `payCurrency` ("btc" | "eth" | "usdc" | "usdt") till NOWPayments
 * coin-koder.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateDiscountForSubtotal } from "@/lib/discounts.server";
import { nowPaymentsBaseUrl } from "@/server/nowpayments.server";

const ItemSchema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(300),
  price: z.number().min(0),
  quantity: z.number().int().min(1).max(999),
});

const PayCurrencySchema = z.enum(["btc", "eth", "usdc", "usdt"]);

const BodySchema = z.object({
  orderId: z.string().min(3).max(80),
  amount: z.number().min(0),
  currency: z.string().length(3).default("SEK"),
  payCurrency: PayCurrencySchema.optional(),
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

/**
 * Mappa vår enkla coin-symbol till NOWPayments coin-kod. NOWPayments kräver
 * att man pekar ut chain för USDC/USDT — vi väljer billigaste rimliga (Polygon
 * för USDC, TRC20 för USDT). Sätt env-overrides om du föredrar andra chains.
 */
function mapPayCurrency(pc: z.infer<typeof PayCurrencySchema>): string {
  switch (pc) {
    case "btc":
      return process.env.NOWPAYMENTS_COIN_BTC || "btc";
    case "eth":
      return process.env.NOWPAYMENTS_COIN_ETH || "eth";
    case "usdc":
      return process.env.NOWPAYMENTS_COIN_USDC || "usdcmatic";
    case "usdt":
      return process.env.NOWPAYMENTS_COIN_USDT || "usdttrc20";
  }
}

function dbErrorDetail(
  err: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
): string {
  if (!err) return "no row returned";
  return [err.message, err.code, err.details, err.hint].filter(Boolean).join(" | ");
}

export const Route = createFileRoute("/api/nowpayments/create-crypto-invoice")({
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

        const apiKey = process.env.NOWPAYMENTS_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "NOWPayments is not configured on this server." },
            { status: 503, headers: corsHeaders },
          );
        }

        // Räkna om totalen server-side.
        const subtotalOre = parsed.items.reduce(
          (sum, i) => sum + Math.round(i.price * 100) * i.quantity,
          0,
        );

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

        const totalOre = Math.max(0, subtotalOre - discountOre);
        const totalAmount = totalOre / 100;

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
            shipping_ore: 0,
            discount_ore: discountOre,
            total_ore: totalOre,
            currency: parsed.currency,
            payment_method: parsed.payCurrency
              ? `nowpayments:${parsed.payCurrency}`
              : "nowpayments:crypto",
            payment_status: "pending",
            metadata: {
              discount: discountInfo,
              provider: "nowpayments",
              pay_currency: parsed.payCurrency ?? null,
            } as never,
          })
          .select("id")
          .single();

        if (orderErr || !orderRow) {
          console.error("[nowpayments.create-crypto-invoice] order insert failed", {
            err: orderErr,
            orderId: parsed.orderId,
          });
          return Response.json(
            { error: `Could not create order: ${dbErrorDetail(orderErr)}` },
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
        const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemRows);
        if (itemsErr) {
          await supabaseAdmin.from("orders").delete().eq("id", (orderRow as { id: string }).id);
          return Response.json(
            { error: `Could not create order items: ${dbErrorDetail(itemsErr)}` },
            { status: 500, headers: corsHeaders },
          );
        }

        const origin = new URL(request.url).origin;
        const ipnCallbackUrl =
          process.env.NOWPAYMENTS_IPN_URL || `${origin}/api/public/nowpayments/webhook`;

        try {
          const res = await fetch(`${nowPaymentsBaseUrl()}/invoice`, {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              price_amount: totalAmount,
              price_currency: parsed.currency.toLowerCase(),
              // Om payCurrency utelämnas låter NOWPayments kunden välja coin
              // på den hostade sidan. Annars pinnar vi vald coin/chain.
              ...(parsed.payCurrency
                ? { pay_currency: mapPayCurrency(parsed.payCurrency) }
                : {}),
              order_id: parsed.orderId,
              order_description: `PeptivaLab order ${parsed.orderId}`,
              ipn_callback_url: ipnCallbackUrl,
              success_url: parsed.successUrl,
              cancel_url: parsed.cancelUrl,
              customer_email: parsed.customer.email,
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("[nowpayments.create-crypto-invoice] invoice failed", res.status, text);
            return Response.json(
              { error: `NOWPayments error (${res.status}): ${text}` },
              { status: 502, headers: corsHeaders },
            );
          }
          const json = (await res.json()) as Record<string, unknown>;
          const invoiceUrl = String(json.invoice_url ?? "");
          const id = String(json.id ?? json.invoice_id ?? "");
          if (!invoiceUrl || !id) {
            return Response.json(
              { error: "NOWPayments did not return invoice_url/id" },
              { status: 502, headers: corsHeaders },
            );
          }

          await supabaseAdmin
            .from("orders")
            .update({
              metadata: {
                discount: discountInfo,
                provider: "nowpayments",
                pay_currency: parsed.payCurrency ?? null,
                nowpayments_invoice_id: id,
              } as never,
            })
            .eq("id", (orderRow as { id: string }).id);

          return Response.json(
            {
              invoiceUrl,
              invoiceId: id,
              totals: {
                subtotal: subtotalOre / 100,
                shipping: 0,
                discount: discountInfo
                  ? { ...discountInfo, amount: discountInfo.amount / 100 }
                  : null,
                total: totalAmount,
              },
            },
            { headers: corsHeaders },
          );
        } catch (err) {
          console.error("[nowpayments.create-crypto-invoice] provider error", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "NOWPayments request failed" },
            { status: 502, headers: corsHeaders },
          );
        }
      },
    },
  },
});
