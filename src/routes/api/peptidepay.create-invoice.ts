/**
 * POST /api/peptidepay/create-invoice
 *
 * Skapar en hosted checkout-session hos Peptide-Pay och returnerar URL:en
 * att redirecta kunden till. Kunden kan välja kort (Visa/Mastercard, Apple
 * Pay, Google Pay) eller krypto på Peptide-Pay's sida; merchanten får alltid
 * USDC i sin wallet och webhook fires inom ~30s.
 *
 * Docs: https://peptide-pay.com/docs
 *
 * Required env:
 *   PEPTIDEPAY_API_KEY        — sk_live_… från peptide-pay.com/app/api-keys
 *   PEPTIDEPAY_WEBHOOK_SECRET — secret från dashboard (Webhooks)
 *
 * Webhook target (konfigureras per session nedan, men kan också sättas i
 * dashboarden):
 *   https://<your-domain>/api/public/peptidepay/webhook
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateDiscountForSubtotal } from "@/lib/discounts.server";

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

const PEPTIDEPAY_API = "https://peptide-pay.com/api/v1";
// Peptide-Pay supports: EUR, USD, GBP, CAD, AUD, CHF. SEK saknas — vi konverterar
// SEK → EUR med en grov kurs så vi kan ta emot betalningen. Justera vid behov
// eller exponera som env-var.
const SEK_TO_EUR = Number(process.env.PEPTIDEPAY_SEK_TO_EUR ?? "0.087");
const PP_SUPPORTED = new Set(["EUR", "USD", "GBP", "CAD", "AUD", "CHF"]);

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

        const apiKey = process.env.PEPTIDEPAY_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "Peptide-Pay is not configured on this server." },
            { status: 503, headers: corsHeaders },
          );
        }

        // Räkna om totalen server-side i öre.
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

        // Mappa till en valuta Peptide-Pay förstår.
        const localCurrency = parsed.currency.toUpperCase();
        let ppCurrency = localCurrency;
        let ppAmountCents: number;
        if (PP_SUPPORTED.has(localCurrency)) {
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

        // Skapa order (pending).
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

        // Härleda webhook-URL från request-origin om inte explicit satt.
        const explicit = process.env.PEPTIDEPAY_WEBHOOK_URL;
        const origin = new URL(request.url).origin;
        const webhookUrl = explicit || `${origin}/api/public/peptidepay/webhook`;

        // Skapa checkout-session hos Peptide-Pay.
        let sessionUrl: string;
        let sessionId: string;
        try {
          const res = await fetch(`${PEPTIDEPAY_API}/checkout/init`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "Idempotency-Key": parsed.orderId,
            },
            body: JSON.stringify({
              amount_cents: ppAmountCents,
              currency: ppCurrency,
              customer_email: parsed.customer.email,
              success_url: parsed.successUrl,
              cancel_url: parsed.cancelUrl,
              webhook_url: webhookUrl,
              product_name: `PeptivaLab order ${parsed.orderId}`,
              metadata: {
                order_id: parsed.orderId,
                local_currency: localCurrency,
                local_amount_cents: String(totalOre),
              },
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("[peptidepay.create-invoice] init failed", res.status, text);
            return Response.json(
              { error: `Peptide-Pay error (${res.status}): ${text}` },
              { status: 502, headers: corsHeaders },
            );
          }
          const json = (await res.json()) as {
            id?: string;
            url?: string;
            tracking_number?: string;
          };
          if (!json.url || !json.id) {
            return Response.json(
              { error: "Peptide-Pay returned no session URL" },
              { status: 502, headers: corsHeaders },
            );
          }
          sessionUrl = json.url;
          sessionId = json.id;
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Peptide-Pay request failed" },
            { status: 502, headers: corsHeaders },
          );
        }

        // Spara session-id i ordern.
        await supabaseAdmin
          .from("orders")
          .update({
            metadata: {
              discount: discountInfo,
              provider: "peptidepay",
              pp_currency: ppCurrency,
              pp_amount_cents: ppAmountCents,
              peptidepay_session_id: sessionId,
            } as never,
          })
          .eq("id", (orderRow as { id: string }).id);

        return Response.json(
          {
            invoiceUrl: sessionUrl,
            invoiceId: sessionId,
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
