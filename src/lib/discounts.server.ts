// Server-only discount helpers. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
