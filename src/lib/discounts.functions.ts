/**
 * Discount code server functions (thin wrappers — only createServerFn here).
 * Helpers and admin client live in ./discounts.server.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminAuthMiddleware } from "@/lib/admin-middleware";
import type { DbDiscountCode } from "@/lib/discounts.server";

export type { DbDiscountCode, ValidateResult } from "@/lib/discounts.server";

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/i, "Endast bokstäver, siffror, _ och -"),
  type: z.enum(["percent", "fixed"]),
  value: z.number().positive(),
  minSubtotalOre: z.number().int().min(0).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  active: z.boolean().default(true),
  description: z.string().trim().max(200).nullable().optional(),
});

export const listDiscountCodes = createServerFn({ method: "GET" })
  .middleware([adminAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("discount_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { codes: (data ?? []) as DbDiscountCode[] };
  });

export const upsertDiscountCode = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => UpsertSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      code: data.code.trim().toUpperCase(),
      type: data.type,
      value: data.value,
      min_subtotal_ore: data.minSubtotalOre ?? null,
      expires_at: data.expiresAt ?? null,
      max_uses: data.maxUses ?? null,
      active: data.active,
      description: data.description ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("discount_codes")
        .update(row as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("discount_codes")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const deleteDiscountCode = createServerFn({ method: "POST" })
  .middleware([adminAuthMiddleware])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("discount_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
