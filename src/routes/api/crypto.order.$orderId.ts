/**
 * GET /api/crypto/order/:orderId
 *
 * Returns the current status of an order so the confirmation page can
 * poll until the payment completes.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export const Route = createFileRoute("/api/crypto/order/$orderId")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ params }) => {
        const orderId = params.orderId;
        if (!orderId || orderId.length > 80) {
          return Response.json(
            { error: "Invalid order id" },
            { status: 400, headers: corsHeaders },
          );
        }

        const { data, error } = await supabaseAdmin
          .from("orders")
          .select("order_number, payment_status, fulfillment_status, total_ore, currency, created_at")
          .eq("order_number", orderId)
          .maybeSingle();

        if (error) {
          return Response.json(
            { error: error.message },
            { status: 500, headers: corsHeaders },
          );
        }
        if (!data) {
          return Response.json(
            { status: "unknown", error: "Order not found" },
            { status: 404, headers: corsHeaders },
          );
        }

        const row = data as {
          order_number: string;
          payment_status: string;
          fulfillment_status: string;
          total_ore: number;
          currency: string;
          created_at: string;
        };

        return Response.json(
          {
            orderId: row.order_number,
            status: row.payment_status,
            fulfillment: row.fulfillment_status,
            total: row.total_ore / 100,
            currency: row.currency,
            createdAt: row.created_at,
          },
          { headers: corsHeaders },
        );
      },
    },
  },
});
