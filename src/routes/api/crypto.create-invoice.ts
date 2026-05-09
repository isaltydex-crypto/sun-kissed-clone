/**
 * POST /api/crypto/create-invoice
 *
 * Called by the storefront checkout. Persists the order as `pending`,
 * creates a NOWPayments hosted invoice, and returns its URL.
 *
 * Required env on the server:
 *   NOWPAYMENTS_API_KEY        — from nowpayments.io dashboard
 *   NOWPAYMENTS_BASE_URL       — defaults to https://api.nowpayments.io/v1
 *   CRYPTO_SUCCESS_URL         — optional override of body.successUrl
 *   CRYPTO_CANCEL_URL          — optional override of body.cancelUrl
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
  payCurrency: z.enum(["btc", "eth", "usdc", "usdt"]),
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

        const apiKey = process.env.NOWPAYMENTS_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "Crypto payments are not configured on this server." },
            { status: 503, headers: corsHeaders },
          );
        }
        const baseUrl =
          process.env.NOWPAYMENTS_BASE_URL?.replace(/\/$/, "") ??
          "https://api.nowpayments.io/v1";

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

        // Persist the order (pending). We use order_number = parsed.orderId so
        // the IPN webhook can find it via NOWPayments' order_id field.
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
            payment_method: `crypto:${parsed.payCurrency}`,
            payment_status: "pending",
            metadata: {
              discount: discountInfo,
              pay_currency: parsed.payCurrency,
            } as never,
          })
          .select("id")
          .single();

        if (orderErr || !orderRow) {
          return Response.json(
            { error: orderErr?.message ?? "Could not create order" },
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

        // Call NOWPayments to create an invoice.
        let invoice: { id: string | number; invoice_url: string };
        try {
          const res = await fetch(`${baseUrl}/invoice`, {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              price_amount: totalSek,
              price_currency: parsed.currency.toLowerCase(),
              pay_currency: parsed.payCurrency,
              order_id: parsed.orderId,
              order_description: `peptivaLab order ${parsed.orderId}`,
              ipn_callback_url: `${new URL(parsed.successUrl).origin}/api/public/crypto/webhook`,
              success_url: process.env.CRYPTO_SUCCESS_URL || parsed.successUrl,
              cancel_url: process.env.CRYPTO_CANCEL_URL || parsed.cancelUrl,
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return Response.json(
              { error: `NOWPayments error (${res.status}): ${text}` },
              { status: 502, headers: corsHeaders },
            );
          }
          invoice = (await res.json()) as { id: string | number; invoice_url: string };
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "NOWPayments request failed" },
            { status: 502, headers: corsHeaders },
          );
        }

        // Store the invoice id on the order so we can correlate later.
        await supabaseAdmin
          .from("orders")
          .update({
            metadata: {
              discount: discountInfo,
              pay_currency: parsed.payCurrency,
              nowpayments_invoice_id: String(invoice.id),
            } as never,
          })
          .eq("id", (orderRow as { id: string }).id);

        return Response.json(
          {
            invoiceUrl: invoice.invoice_url,
            invoiceId: String(invoice.id),
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
