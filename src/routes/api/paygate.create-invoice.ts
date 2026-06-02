/**
 * POST /api/paygate/create-invoice
 *
 * Creates a PayGate.to hosted checkout link and returns the URL the customer
 * should be redirected to. Server validates catalog totals (no client-supplied
 * amount reaches PayGate).
 *
 * Configure via env:
 *   PAYGATE_WALLET           Merchant USDC (Polygon) payout wallet (required)
 *   PAYGATE_CALLBACK_SECRET  Unguessable token embedded in the callback URL
 *   PAYGATE_PROVIDER         Optional single provider id (omit = multi-provider)
 *   PAYGATE_SEK_TO_USD       Rate used to convert SEK → USD (default 0.094)
 *   PAYGATE_CALLBACK_URL     Optional full callback URL override
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateDiscountForSubtotal } from "@/lib/discounts.server";
import {
  buildPaygateCheckoutUrl,
  createPaygateWallet,
  PaygateError,
} from "@/lib/paygate.server";

const ItemSchema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(300),
  price: z.number().min(0),
  quantity: z.number().int().min(1).max(999),
});

const BodySchema = z.object({
  orderId: z.string().min(3).max(80),
  currency: z.string().length(3).default("SEK"),
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

// PayGate accepts USD/EUR/CAD plus a handful of regional currencies; SEK is
// not directly supported on most providers. Convert SEK → USD.
const SEK_TO_USD = Number(process.env.PAYGATE_SEK_TO_USD ?? "0.094");
const PG_SUPPORTED = new Set(["USD", "EUR", "CAD", "GBP", "AUD", "CHF"]);

function dbErrorDetail(
  err: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
): string {
  if (!err) return "no row returned";
  return [err.message, err.code, err.details, err.hint].filter(Boolean).join(" | ");
}

export const Route = createFileRoute("/api/paygate/create-invoice")({
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

        const payoutWallet = process.env.PAYGATE_WALLET?.trim();
        const callbackSecret = process.env.PAYGATE_CALLBACK_SECRET?.trim();
        if (!payoutWallet) {
          return Response.json(
            { error: "PAYGATE_WALLET is not configured on this server." },
            { status: 503, headers: corsHeaders },
          );
        }
        if (!callbackSecret) {
          return Response.json(
            { error: "PAYGATE_CALLBACK_SECRET is not configured on this server." },
            { status: 503, headers: corsHeaders },
          );
        }

        // Authoritative server-side total in öre.
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
        const totalLocal = totalOre / 100;

        const localCurrency = parsed.currency.toUpperCase();
        let pgCurrency: string;
        let pgAmount: number;
        if (PG_SUPPORTED.has(localCurrency)) {
          pgCurrency = localCurrency;
          pgAmount = totalLocal;
        } else if (localCurrency === "SEK") {
          pgCurrency = "USD";
          pgAmount = Math.max(1, totalLocal * SEK_TO_USD);
        } else {
          return Response.json(
            { error: `Currency ${localCurrency} not supported by PayGate.` },
            { status: 400, headers: corsHeaders },
          );
        }
        // PayGate expects 2 decimals.
        pgAmount = Math.round(pgAmount * 100) / 100;

        // Persist pending order.
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
            payment_method: "paygate",
            payment_status: "pending",
            metadata: {
              discount: discountInfo,
              provider: "paygate",
              pg_currency: pgCurrency,
              pg_amount: pgAmount,
            } as never,
          })
          .select("id")
          .single();

        if (orderErr || !orderRow) {
          console.error("[paygate.create-invoice] order insert failed", {
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
          console.error("[paygate.create-invoice] item insert failed", { err: itemsErr });
          await supabaseAdmin.from("orders").delete().eq("id", (orderRow as { id: string }).id);
          return Response.json(
            { error: `Could not create order items: ${dbErrorDetail(itemsErr)}` },
            { status: 500, headers: corsHeaders },
          );
        }

        // Build callback URL. PayGate hits this with a GET request, replaying
        // every query param + adding `value_coin` (USDC received).
        const origin = new URL(request.url).origin;
        const callbackBase =
          process.env.PAYGATE_CALLBACK_URL || `${origin}/api/public/paygate-callback`;
        const callbackUrl = new URL(callbackBase);
        callbackUrl.searchParams.set("order", parsed.orderId);
        callbackUrl.searchParams.set("t", callbackSecret);

        let wallet;
        try {
          wallet = await createPaygateWallet({
            payoutWallet,
            callbackUrl: callbackUrl.toString(),
          });
        } catch (err) {
          if (err instanceof PaygateError) {
            console.error("[paygate.create-invoice] wallet.php failed", err.status, err.body);
          }
          await supabaseAdmin
            .from("orders")
            .delete()
            .eq("id", (orderRow as { id: string }).id);
          return Response.json(
            { error: err instanceof Error ? err.message : "PayGate request failed" },
            { status: 502, headers: corsHeaders },
          );
        }

        const checkoutUrl = buildPaygateCheckoutUrl({
          addressIn: wallet.address_in,
          amount: pgAmount,
          currency: pgCurrency,
          email: parsed.customer.email,
          provider: process.env.PAYGATE_PROVIDER || undefined,
          logoUrl: process.env.PAYGATE_LOGO_URL || undefined,
          themeColor: process.env.PAYGATE_THEME_COLOR || undefined,
          buttonColor: process.env.PAYGATE_BUTTON_COLOR || undefined,
          backgroundColor: process.env.PAYGATE_BACKGROUND_COLOR || undefined,
        });

        await supabaseAdmin
          .from("orders")
          .update({
            metadata: {
              discount: discountInfo,
              provider: "paygate",
              pg_currency: pgCurrency,
              pg_amount: pgAmount,
              paygate_address_in: wallet.address_in,
              paygate_polygon_address: wallet.polygon_address_in,
              paygate_ipn_token: wallet.ipn_token,
              success_url: parsed.successUrl,
              cancel_url: parsed.cancelUrl,
            } as never,
          })
          .eq("id", (orderRow as { id: string }).id);

        return Response.json(
          {
            invoiceUrl: checkoutUrl,
            invoiceId: wallet.address_in,
            totals: {
              subtotal: subtotalOre / 100,
              shipping: 0,
              discount: discountInfo
                ? { ...discountInfo, amount: discountInfo.amount / 100 }
                : null,
              total: totalLocal,
            },
          },
          { headers: corsHeaders },
        );
      },
    },
  },
});
