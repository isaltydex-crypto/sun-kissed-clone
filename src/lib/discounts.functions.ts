/**
 * Discount code server functions.
 * - Admin CRUD (protected by adminAuthMiddleware)
 * - Public validate (used by checkout via /api/discount/validate)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminAuthMiddleware } from "@/server/admin-middleware";

export type DbDiscountCode = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_subtotal_ore: number | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

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
    const { error } = await supabaseAdmin.from("discount_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Pure validator used by both the API route and any server-side call ───
export type ValidateResult =
  | {
      ok: true;
      discount: {
        code: string;
        type: "percent" | "fixed";
        value: number;
        amount: number; // in ore
        description?: string;
      };
    }
  | { ok: false; error: string };

export async function validateDiscountForSubtotal(
  rawCode: string,
  subtotalOre: number,
): Promise<ValidateResult> {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Ange en rabattkod" };

  const { data, error } = await supabaseAdmin
    .from("discount_codes")
    .select("*")
    .ilike("code", code)
    .maybeSingle();

  if (error) return { ok: false, error: "Kunde inte validera koden" };
  if (!data) return { ok: false, error: "Ogiltig rabattkod" };

  const row = data as DbDiscountCode;
  if (!row.active) return { ok: false, error: "Rabattkoden är inaktiverad" };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Rabattkoden har gått ut" };
  }
  if (row.max_uses != null && row.used_count >= row.max_uses) {
    return { ok: false, error: "Rabattkoden har använts för många gånger" };
  }
  if (row.min_subtotal_ore != null && subtotalOre < row.min_subtotal_ore) {
    return {
      ok: false,
      error: `Kräver minst ${(row.min_subtotal_ore / 100).toFixed(0)} kr i varukorgen`,
    };
  }

  const rawAmount =
    row.type === "percent"
      ? Math.round((subtotalOre * row.value) / 100)
      : Math.round(row.value * 100);
  const amount = Math.min(rawAmount, subtotalOre);

  return {
    ok: true,
    discount: {
      code: row.code.toUpperCase(),
      type: row.type,
      value: row.value,
      amount,
      description: row.description ?? undefined,
    },
  };
}

export async function incrementDiscountUsage(code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  const { data } = await supabaseAdmin
    .from("discount_codes")
    .select("id, used_count")
    .ilike("code", normalized)
    .maybeSingle();
  if (!data) return;
  const row = data as { id: string; used_count: number };
  await supabaseAdmin
    .from("discount_codes")
    .update({ used_count: row.used_count + 1 } as never)
    .eq("id", row.id);
}
