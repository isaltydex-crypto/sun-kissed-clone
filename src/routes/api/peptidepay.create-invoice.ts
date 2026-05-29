/**
 * POST /api/peptidepay/create-invoice
 *
 * Creates a Peptide-Pay hosted checkout session and returns the URL to
 * redirect the customer to. Server-side validates catalog prices via the
 * `items` array (no client-supplied totals reach Peptide-Pay).
 *
 * Auth: pass either PEPTIDEPAY_API_KEY (advanced) OR PEPTIDEPAY_WALLET
 * (wallet-only mode). Webhook secret PEPTIDEPAY_WEBHOOK_SECRET is required
 * for IPN verification at /api/public/peptidepay-webhook.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateDiscountForSubtotal } from "@/lib/discounts.server";
import { createPeptidePaySession, PeptidePayError } from "@/lib/peptidepay.server";

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

// Peptide-Pay accepts EUR, USD, GBP, CAD, AUD, CHF. SEK isn't supported, so
// convert SEK → EUR for the gateway (override via PEPTIDEPAY_SEK_TO_EUR).
const SEK_TO_EUR = Number(process.env.PEPTIDEPAY_SEK_TO_EUR ?? "0.087");
const PP_SUPPORTED = new Set(["EUR", "USD", "GBP", "CAD", "AUD", "CHF"] as const);

type PpCurrency = "EUR" | "USD" | "GBP" | "CAD" | "AUD" | "CHF";

function dbErrorDetail(
  err: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
): string {
  if (!err) return "no row returned";
  return [err.message, err.code, err.details, err.hint].filter(Boolean).join(" | ");
}

export const Route = createFileRoute("/api/peptidepay/create-invoice")({
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

        if (!process.env.PEPTIDEPAY_API_KEY && !process.env.PEPTIDEPAY_WALLET) {
          return Response.json(
            { error: "Peptide-Pay is not configured on this server." },
            { status: 503, headers: corsHeaders },
          );
        }

        // Authoritative server-side total (öre).
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
        let ppCurrency: PpCurrency;
        let ppAmountCents: number;
        if (PP_SUPPORTED.has(localCurrency as PpCurrency)) {
          ppCurrency = localCurrency as PpCurrency;
          ppAmountCents = totalOre;
        } else if (localCurrency === "SEK") {
          ppCurrency = "EUR";
          ppAmountCents = Math.max(100, Math.round(totalLocal * SEK_TO_EUR * 100));
        } else {
          return Response.json(
            { error: `Currency ${localCurrency} not supported by Peptide-Pay.` },
            { status: 400, headers: corsHeaders },
          );
        }

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
            payment_method: "peptidepay",
            payment_status: "pending",
            metadata: {
              discount: discountInfo,
              provider: "peptidepay",
              pp_currency: ppCurrency,
              pp_amount_cents: ppAmountCents,
            } as never,
          })
          .select("id")
          .single();

        if (orderErr || !orderRow) {
          console.error("[peptidepay.create-invoice] order insert failed", {
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
          console.error("[peptidepay.create-invoice] item insert failed", { err: itemsErr });
          await supabaseAdmin.from("orders").delete().eq("id", (orderRow as { id: string }).id);
          return Response.json(
            { error: `Could not create order items: ${dbErrorDetail(itemsErr)}` },
            { status: 500, headers: corsHeaders },
          );
        }

        // Webhook URL — `/api/public/*` so Lovable's published-site auth lets
        // external callers (Peptide-Pay's IPN) through.
        const origin = new URL(request.url).origin;
        const webhookUrl =
          process.env.PEPTIDEPAY_WEBHOOK_URL || `${origin}/api/public/peptidepay-webhook`;

        let session;
        try {
          session = await createPeptidePaySession({
            amountCents: ppAmountCents,
            currency: ppCurrency,
            customerEmail: parsed.customer.email,
            successUrl: parsed.successUrl,
            cancelUrl: parsed.cancelUrl,
            webhookUrl,
            productName: `PeptivaLab order ${parsed.orderId}`,
            idempotencyKey: parsed.orderId,
            metadata: {
              order_id: parsed.orderId,
              local_currency: localCurrency,
              local_amount_cents: String(totalOre),
            },
          });
        } catch (err) {
          if (err instanceof PeptidePayError) {
            console.error("[peptidepay.create-invoice] init failed", err.status, err.body);
            return Response.json(
              { error: err.message },
              { status: err.status && err.status >= 400 && err.status < 600 ? 502 : 502, headers: corsHeaders },
            );
          }
          return Response.json(
            { error: err instanceof Error ? err.message : "Peptide-Pay request failed" },
            { status: 502, headers: corsHeaders },
          );
        }

        await supabaseAdmin
          .from("orders")
          .update({
            metadata: {
              discount: discountInfo,
              provider: "peptidepay",
              pp_currency: ppCurrency,
              pp_amount_cents: ppAmountCents,
              peptidepay_session_id: session.id,
            } as never,
          })
          .eq("id", (orderRow as { id: string }).id);

        return Response.json(
          {
            invoiceUrl: session.url,
            invoiceId: session.id,
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
