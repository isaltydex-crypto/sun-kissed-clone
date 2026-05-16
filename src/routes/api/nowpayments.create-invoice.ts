/**
 * POST /api/nowpayments/create-invoice
 *
 * Creates a NOWPayments hosted invoice for the chosen rail
 * (google_pay | apple_pay | samsung_pay) and persists the order as
 * `pending`. The buyer is redirected to `invoiceUrl`.
 *
 * NOTE: this endpoint is wired but is NOT yet exposed in the checkout UI
 * as a selectable payment method. It exists so the rest of the system
 * (DB row, IPN verification, status mapping) is ready to flip on later.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateDiscountForSubtotal } from "@/lib/discounts.server";
import {
  createNowPaymentsInvoice,
  NOWPAYMENTS_RAILS,
  type NowPaymentsRail,
} from "@/server/nowpayments.server";

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
  currency: z.string().length(3).default("SEK"),
  rail: z.enum(NOWPAYMENTS_RAILS as unknown as [NowPaymentsRail, ...NowPaymentsRail[]]),
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

function dbErrorDetail(
  err: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
): string {
  if (!err) return "no row returned";
  return [err.message, err.code, err.details, err.hint].filter(Boolean).join(" | ");
}

export const Route = createFileRoute("/api/nowpayments/create-invoice")({
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

        if (!process.env.NOWPAYMENTS_API_KEY) {
          return Response.json(
            { error: "NOWPayments is not configured on this server." },
            { status: 503, headers: corsHeaders },
          );
        }

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
            shipping_ore: shippingOre,
            discount_ore: discountOre,
            total_ore: totalOre,
            currency: parsed.currency,
            payment_method: `nowpayments:${parsed.rail}`,
            payment_status: "pending",
            metadata: {
              discount: discountInfo,
              rail: parsed.rail,
              provider: "nowpayments",
            } as never,
          })
          .select("id")
          .single();

        if (orderErr || !orderRow) {
          console.error("[nowpayments.create-invoice] order insert failed", {
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

        // Resolve IPN callback URL from the incoming request origin unless overridden.
        const origin = new URL(request.url).origin;
        const ipnCallbackUrl =
          process.env.NOWPAYMENTS_IPN_URL || `${origin}/api/public/nowpayments/webhook`;

        try {
          const invoice = await createNowPaymentsInvoice({
            orderId: parsed.orderId,
            amount: totalAmount,
            currency: parsed.currency,
            rail: parsed.rail,
            description: `PeptivaLab order ${parsed.orderId}`,
            successUrl: parsed.successUrl,
            cancelUrl: parsed.cancelUrl,
            ipnCallbackUrl,
            customerEmail: parsed.customer.email,
          });

          await supabaseAdmin
            .from("orders")
            .update({
              metadata: {
                discount: discountInfo,
                rail: parsed.rail,
                provider: "nowpayments",
                nowpayments_invoice_id: invoice.id,
              } as never,
            })
            .eq("id", (orderRow as { id: string }).id);

          return Response.json(
            {
              invoiceUrl: invoice.invoiceUrl,
              invoiceId: invoice.id,
              totals: {
                subtotal: subtotalOre / 100,
                shipping: shippingOre / 100,
                discount: discountInfo
                  ? { ...discountInfo, amount: discountInfo.amount / 100 }
                  : null,
                total: totalAmount,
              },
            },
            { headers: corsHeaders },
          );
        } catch (err) {
          console.error("[nowpayments.create-invoice] provider error", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "NOWPayments request failed" },
            { status: 502, headers: corsHeaders },
          );
        }
      },
    },
  },
});
