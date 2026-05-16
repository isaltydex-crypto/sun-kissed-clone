/**
 * NOWPayments helpers (server-only).
 *
 * Docs:
 *   - API:  https://documenter.getpostman.com/view/7907941/2s93JusNJt
 *   - IPN:  https://nowpayments.io/help/article/how-to-verify-ipn-callback-signature
 *
 * NOWPayments signs each IPN callback with HMAC-SHA512 over the JSON body
 * with its **keys sorted alphabetically** (lowercase hex digest). The
 * signature is delivered in the `x-nowpayments-sig` header.
 *
 * Card-rail payment methods that NOWPayments wraps for us (still settled
 * on-chain): "google_pay", "apple_pay", "samsung_pay". They are forwarded
 * via the `pay_currency` field on the payment payload.
 *
 * Required env on the server:
 *   NOWPAYMENTS_API_KEY     — from account.nowpayments.io
 *   NOWPAYMENTS_IPN_SECRET  — IPN secret from the same dashboard
 *   NOWPAYMENTS_BASE_URL    — defaults to https://api.nowpayments.io/v1
 *   NOWPAYMENTS_SANDBOX     — "1" to use https://api-sandbox.nowpayments.io/v1
 */
import { createHmac, timingSafeEqual } from "crypto";

export type NowPaymentsRail =
  | "google_pay"
  | "apple_pay"
  | "samsung_pay";

export const NOWPAYMENTS_RAILS: readonly NowPaymentsRail[] = [
  "google_pay",
  "apple_pay",
  "samsung_pay",
] as const;

export function nowPaymentsBaseUrl(): string {
  if (process.env.NOWPAYMENTS_BASE_URL) {
    return process.env.NOWPAYMENTS_BASE_URL.replace(/\/$/, "");
  }
  return process.env.NOWPAYMENTS_SANDBOX === "1"
    ? "https://api-sandbox.nowpayments.io/v1"
    : "https://api.nowpayments.io/v1";
}

/** Deterministic JSON stringify with keys sorted at every depth. */
export function sortedJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => sortedJsonStringify(v)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + sortedJsonStringify(obj[k]))
      .join(",") +
    "}"
  );
}

export function signNowPaymentsPayload(payload: unknown, ipnSecret: string): string {
  return createHmac("sha512", ipnSecret).update(sortedJsonStringify(payload)).digest("hex");
}

export function verifyNowPaymentsSignature(
  rawBody: string,
  signatureHeader: string | null,
  ipnSecret: string,
): boolean {
  if (!signatureHeader || !ipnSecret) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const expected = signNowPaymentsPayload(parsed, ipnSecret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Map NOWPayments `payment_status` onto our internal order status.
 *
 * NOWPayments statuses: waiting, confirming, confirmed, sending, partially_paid,
 * finished, failed, refunded, expired.
 */
export function mapNowPaymentsStatus(s: string): "pending" | "paid" | "failed" {
  switch (s) {
    case "finished":
    case "confirmed":
    case "sending":
      return "paid";
    case "failed":
    case "refunded":
    case "expired":
      return "failed";
    default:
      return "pending";
  }
}

export type NowPaymentsCreateInvoiceInput = {
  orderId: string;
  amount: number;
  currency: string; // fiat, e.g. "SEK"
  rail: NowPaymentsRail;
  description?: string;
  successUrl: string;
  cancelUrl: string;
  ipnCallbackUrl: string;
  customerEmail?: string;
};

export type NowPaymentsInvoice = {
  id: string;
  invoiceUrl: string;
  rawResponse: Record<string, unknown>;
};

/**
 * Creates a hosted NOWPayments invoice. The buyer is redirected to
 * `invoice_url`; once paid, NOWPayments POSTs to `ipnCallbackUrl`.
 */
export async function createNowPaymentsInvoice(
  input: NowPaymentsCreateInvoiceInput,
): Promise<NowPaymentsInvoice> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error("NOWPAYMENTS_API_KEY is not configured");

  const res = await fetch(`${nowPaymentsBaseUrl()}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: input.amount,
      price_currency: input.currency.toLowerCase(),
      pay_currency: input.rail,
      order_id: input.orderId,
      order_description: input.description ?? `Order ${input.orderId}`,
      ipn_callback_url: input.ipnCallbackUrl,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`NOWPayments error (${res.status}): ${text}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  const invoiceUrl = String(json.invoice_url ?? "");
  const id = String(json.id ?? json.invoice_id ?? "");
  if (!invoiceUrl || !id) {
    throw new Error("NOWPayments did not return invoice_url/id");
  }
  return { id, invoiceUrl, rawResponse: json };
}
