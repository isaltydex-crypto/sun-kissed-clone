import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { validateDiscountForSubtotal } from "@/lib/discounts.functions";

const BodySchema = z.object({
  code: z.string().trim().min(1).max(40),
  items: z
    .array(
      z.object({
        slug: z.string().min(1).max(120),
        price: z.number().min(0), // SEK per unit
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(50),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export const Route = createFileRoute("/api/discount/validate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = BodySchema.parse(body);
          const subtotalOre = parsed.items.reduce(
            (sum, i) => sum + Math.round(i.price * 100) * i.quantity,
            0,
          );
          const result = await validateDiscountForSubtotal(parsed.code, subtotalOre);
          if (!result.ok) {
            return Response.json({ ok: false, error: result.error }, { headers: corsHeaders });
          }
          // Convert ore back to SEK for the client (matches paymentsApi.ServerDiscount).
          return Response.json(
            {
              ok: true,
              discount: {
                code: result.discount.code,
                type: result.discount.type,
                value: result.discount.value,
                amount: result.discount.amount / 100,
                description: result.discount.description,
              },
            },
            { headers: corsHeaders },
          );
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Bad request" },
            { status: 400, headers: corsHeaders },
          );
        }
      },
    },
  },
});
