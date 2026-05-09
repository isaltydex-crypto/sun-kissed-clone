/**
 * Order persistence: server functions to record and list orders.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminAuthMiddleware } from "@/server/admin-middleware";

const ItemSchema = z.object({
  productId: z.string().min(1).max(200),
  productName: z.string().min(1).max(300),
  unitPriceOre: z.number().int().min(0),
  quantity: z.number().int().min(1).max(999),
});

const RecordOrderSchema = z.object({
  orderNumber: z.string().min(3).max(64),
  customer: z.object({
    email: z.string().trim().email().max(255),
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().max(60).optional(),
    address: z.string().trim().max(300).optional(),
    postalCode: z.string().trim().max(20).optional(),
    city: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
  items: z.array(ItemSchema).min(1).max(50),
  subtotalOre: z.number().int().min(0),
  shippingOre: z.number().int().min(0),
  discountOre: z.number().int().min(0).default(0),
  totalOre: z.number().int().min(0),
  currency: z.string().trim().length(3).default("SEK"),
  paymentMethod: z.string().trim().max(60).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const recordOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => RecordOrderSchema.parse(input))
  .handler(async ({ data }) => {
    // Server-side total recompute as a sanity check.
    const computedSubtotal = data.items.reduce(
      (sum, i) => sum + i.unitPriceOre * i.quantity,
      0,
    );
    const computedTotal = computedSubtotal + data.shippingOre - data.discountOre;
    if (Math.abs(computedTotal - data.totalOre) > 1) {
      throw new Error("Totals do not match items.");
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number: data.orderNumber,
        customer_email: data.customer.email,
        customer_name: data.customer.name,
        customer_phone: data.customer.phone ?? null,
        shipping_address: {
          address: data.customer.address ?? null,
          postal_code: data.customer.postalCode ?? null,
          city: data.customer.city ?? null,
          notes: data.customer.notes ?? null,
        } as never,
        subtotal_ore: data.subtotalOre,
        shipping_ore: data.shippingOre,
        discount_ore: data.discountOre,
        total_ore: data.totalOre,
        currency: data.currency,
        payment_method: data.paymentMethod ?? null,
        metadata: (data.metadata ?? {}) as never,
      })
      .select("id, order_number")
      .single();

    if (error) throw new Error(error.message);

    const itemRows = data.items.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      product_name: i.productName,
      unit_price_ore: i.unitPriceOre,
      quantity: i.quantity,
      line_total_ore: i.unitPriceOre * i.quantity,
    }));
    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemRows);
    if (itemsErr) throw new Error(itemsErr.message);

    return { id: order.id, orderNumber: order.order_number };
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([adminAuthMiddleware])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { orders: data ?? [] };
  });

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  fulfillmentStatus: z.enum(["new", "processing", "shipped", "delivered", "cancelled"]).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => UpdateStatusSchema.parse(input))
  .handler(async ({ data }) => {
    const patch: Record<string, unknown> = {};
    if (data.paymentStatus) patch.payment_status = data.paymentStatus;
    if (data.fulfillmentStatus) patch.fulfillment_status = data.fulfillmentStatus;
    if (typeof data.notes === "string") patch.notes = data.notes;
    const { error } = await supabaseAdmin.from("orders").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    const { logAdminAction } = await import("./admin-auth.server");
    await logAdminAction({
      action: "order.update",
      target: data.id,
      detail: patch,
    });
    return { ok: true };
  });

export const listAdminActions = createServerFn({ method: "GET" })
  .middleware([adminAuthMiddleware])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("admin_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { actions: data ?? [] };
  });
