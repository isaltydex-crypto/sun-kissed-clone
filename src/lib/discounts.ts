// ─────────────────────────────────────────────────────────────
// Discount codes
//
// Edit this list to manage your promo codes. Codes are matched
// case-insensitively. The same logic runs on the server (mirror
// this list in your payments server) to prevent tampering.
//
// Types:
//   - "percent": value is 1–100, applied to subtotal
//   - "fixed":   value is an absolute amount in store currency (SEK)
// ─────────────────────────────────────────────────────────────

export type DiscountCode = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  /** Optional minimum subtotal (in SEK) required to use the code */
  minSubtotal?: number;
  /** Optional ISO date after which the code expires */
  expiresAt?: string;
  /** Optional human description shown to the customer */
  description?: string;
};

export const DISCOUNT_CODES: DiscountCode[] = [
  { code: "WELCOME10", type: "percent", value: 10, description: "10% rabatt" },
  { code: "PEPTI20", type: "percent", value: 20, minSubtotal: 800, description: "20% rabatt vid köp över 800 kr" },
  { code: "SOMMAR50", type: "fixed", value: 50, description: "50 kr rabatt" },
];

export type AppliedDiscount = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  amount: number; // computed discount amount in SEK
  description?: string;
};

export type DiscountResult =
  | { ok: true; discount: AppliedDiscount }
  | { ok: false; error: string };

export function applyDiscountCode(rawCode: string, subtotal: number): DiscountResult {
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized) return { ok: false, error: "Ange en rabattkod" };

  const found = DISCOUNT_CODES.find((d) => d.code.toUpperCase() === normalized);
  if (!found) return { ok: false, error: "Ogiltig rabattkod" };

  if (found.expiresAt && new Date(found.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "Rabattkoden har gått ut" };
  }

  if (found.minSubtotal && subtotal < found.minSubtotal) {
    return {
      ok: false,
      error: `Kräver minst ${found.minSubtotal} kr i varukorgen`,
    };
  }

  const rawAmount =
    found.type === "percent" ? (subtotal * found.value) / 100 : found.value;
  const amount = Math.min(Math.round(rawAmount), subtotal);

  return {
    ok: true,
    discount: {
      code: found.code.toUpperCase(),
      type: found.type,
      value: found.value,
      amount,
      description: found.description,
    },
  };
}
