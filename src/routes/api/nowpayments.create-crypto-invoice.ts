/**
 * POST /api/nowpayments/create-crypto-invoice
 *
 * Skapar en NOWPayments hosted invoice för crypto-direct-betalning
 * (BTC, USDT, ETH m.fl. — kunden betalar direkt från sin wallet, ingen KYC).
 * Server-side prisvalidering via items-array (inga klient-summor tar sig
 * till NOWPayments).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateDiscountForSubtotal } from "@/lib/discounts.server";
import { createNowPaymentsInvoice, NowPaymentsError } from "@/lib/nowpayments.server";

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

const NP_SUPPORTED = new Set(["EUR", "USD", "GBP", "SEK", "NOK", "DKK", "CHF", "CAD", "AUD"]);

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

        if (!process.env.NOWPAYMENTS_API_KEY) {
          return Response.json(
            { error: "NOWPayments är inte konfigurerad på servern." },
            { status: 503, headers: corsHeaders },
          );
        }

        const localCurrency = parsed.currency.toUpperCase();
        if (!NP_SUPPORTED.has(localCurrency)) {
          return Response.json(
            { error: `Valuta ${localCurrency} stöds inte av NOWPayments.` },
            { status: 400, headers: corsHeaders },
          );
        }

        // Authoritative server-side total (öre / cents).
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

        // Create pending order.
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
            payment_method: "nowpayments",
            payment_status: "pending",
            metadata: {
              discount: discountInfo,
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
            { error: `Kunde inte skapa order: ${dbErrorDetail(orderErr)}` },
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
          console.error("[nowpayments.create-invoice] item insert failed", { err: itemsErr });
          await supabaseAdmin.from("orders").delete().eq("id", (orderRow as { id: string }).id);
          return Response.json(
            { error: `Kunde inte skapa orderrader: ${dbErrorDetail(itemsErr)}` },
            { status: 500, headers: corsHeaders },
          );
        }

        const origin = new URL(request.url).origin;
        const ipnCallbackUrl = `${origin}/api/public/nowpayments-webhook`;

        let invoice;
        try {
          invoice = await createNowPaymentsInvoice({
            priceAmount: totalLocal,
            priceCurrency: localCurrency as never,
            orderId: parsed.orderId,
            orderDescription: `PeptivaLab order ${parsed.orderId}`,
            ipnCallbackUrl,
            successUrl: parsed.successUrl,
            cancelUrl: parsed.cancelUrl,
            customerEmail: parsed.customer.email,
          });
        } catch (err) {
          if (err instanceof NowPaymentsError) {
            console.error("[nowpayments.create-invoice] init failed", err.status, err.body);
            return Response.json(
              { error: err.message },
              { status: 502, headers: corsHeaders },
            );
          }
          return Response.json(
            { error: err instanceof Error ? err.message : "NOWPayments request failed" },
            { status: 502, headers: corsHeaders },
          );
        }

        await supabaseAdmin
          .from("orders")
          .update({
            metadata: {
              discount: discountInfo,
              provider: "nowpayments",
              nowpayments_invoice_id: invoice.id,
            } as never,
          })
          .eq("id", (orderRow as { id: string }).id);

        return Response.json(
          {
            invoiceUrl: invoice.invoice_url,
            invoiceId: String(invoice.id),
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
