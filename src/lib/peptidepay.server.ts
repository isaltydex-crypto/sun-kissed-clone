/**
 * Peptide-Pay server helpers.
 *
 * Endpoints used (per peptide-pay.com/docs):
 *   POST https://www.peptide-pay.com/api/v1/checkout/init    — create session
 *   GET  https://www.peptide-pay.com/api/v1/sessions/{id}    — poll status
 *   POST {YOUR_SITE}/api/public/peptidepay-webhook            — signed IPN
 *
 * IMPORTANT — use `www.peptide-pay.com`. The apex 308-redirects and Node
 * `fetch` strips the Authorization header on cross-origin redirects → silent 401.
 *
 * Auth modes:
 *  - Wallet-only: pass `wallet` (PEPTIDEPAY_WALLET) in body, no header.
 *  - Advanced:    `Authorization: Bearer ${PEPTIDEPAY_API_KEY}`, omit `wallet`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const PEPTIDEPAY_API_BASE = "https://www.peptide-pay.com/api/v1";

export type PeptidePayCurrency = "EUR" | "USD" | "GBP" | "CAD" | "CHF" | "AUD";

export interface CreatePeptidePaySessionInput {
  amountCents: number;
  currency: PeptidePayCurrency;
  customerEmail?: string;
  metadata?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
  productName?: string;
  webhookUrl?: string;
  /** Used as Idempotency-Key for safe retries of /checkout/init. */
  idempotencyKey?: string;
}

export interface PeptidePaySession {
  id: string;
  url: string;
  status: string;
  amount: number;
  currency: string;
  expires_at?: string;
}

export class PeptidePayError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * POST /api/v1/checkout/init — returns the hosted checkout session.
 * Redirect the customer to `session.url`.
 */
export async function createPeptidePaySession(
  input: CreatePeptidePaySessionInput,
): Promise<PeptidePaySession> {
  const apiKey = process.env.PEPTIDEPAY_API_KEY;
  const wallet = process.env.PEPTIDEPAY_WALLET;

  if (!apiKey && !wallet) {
    throw new PeptidePayError(
      "Peptide-Pay is not configured. Set PEPTIDEPAY_API_KEY or PEPTIDEPAY_WALLET.",
    );
  }

  if (
    input.amountCents == null ||
    !Number.isFinite(input.amountCents) ||
    input.amountCents < 100 ||
    input.amountCents > 10_000_000
  ) {
    throw new PeptidePayError("amountCents must be an integer between 100 and 10_000_000.");
  }

  const body: Record<string, unknown> = {
    amount_cents: Math.round(input.amountCents),
    currency: input.currency,
  };
  if (input.customerEmail) body.customer_email = input.customerEmail;
  if (input.metadata) body.metadata = input.metadata;
  if (input.successUrl) body.success_url = input.successUrl;
  if (input.cancelUrl) body.cancel_url = input.cancelUrl;
  if (input.productName) body.product_name = input.productName;
  if (input.webhookUrl) body.webhook_url = input.webhookUrl;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    // Authorization header is the identity → do NOT also send `wallet`.
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (wallet) {
    body.wallet = wallet;
  }
  if (input.idempotencyKey) headers["Idempotency-Key"] = input.idempotencyKey;

  const res = await fetch(`${PEPTIDEPAY_API_BASE}/checkout/init`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "error", // surface accidental redirects (auth-stripping) loudly
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PeptidePayError(
      `Peptide-Pay /checkout/init failed (${res.status}): ${text}`,
      res.status,
      text,
    );
  }

  const json = (await res.json()) as Partial<PeptidePaySession> & { id?: string; url?: string };
  if (!json.id || !json.url) {
    throw new PeptidePayError("Peptide-Pay returned no session URL.");
  }
  return json as PeptidePaySession;
}

/**
 * Verify the `x-peptidepay-signature` header.
 * Format: `t=<unix>,v1=<hex HMAC-SHA256("t.rawBody", whsec)>` (Stripe-style).
 *
 * MUST be called with the RAW request body (read via `request.text()`)
 * BEFORE any JSON parsing — re-serialised bodies do not match.
 *
 * - Rejects when t is older/newer than 5 min (replay protection).
 * - Uses crypto.timingSafeEqual for the v1 comparison.
 * - Returns false when the header is missing or malformed.
 */
export function verifyPeptidePaySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(",").map((p) => p.trim());
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!t || !v1) return false;

  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  if (v1.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
