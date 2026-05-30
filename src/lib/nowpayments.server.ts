/**
 * NOWPayments server helpers.
 *
 * Crypto-direct gateway. Buyer redirects to NOWPayments hosted invoice,
 * picks crypto (BTC/USDT/ETH/m.fl.), skickar betalning direkt från sin
 * wallet — INGEN KYC. Settlement i crypto till merchantens NOWPayments-wallet.
 *
 *   POST https://api.nowpayments.io/v1/invoice    — skapa invoice
 *   POST {YOUR_SITE}/api/public/nowpayments-webhook — signed IPN
 *
 * IPN signatur: HMAC-SHA512 av JSON-body med SORTERADE keys,
 * header `x-nowpayments-sig`. MÅSTE verifieras innan parsing.
 *
 * Docs: https://documenter.getpostman.com/view/7907941/S1a32n38
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const NOWPAYMENTS_API_BASE = "https://api.nowpayments.io/v1";

export type NowPaymentsFiat = "EUR" | "USD" | "GBP" | "SEK" | "NOK" | "DKK" | "CHF" | "CAD" | "AUD";

export interface CreateNowPaymentsInvoiceInput {
  priceAmount: number;
  priceCurrency: NowPaymentsFiat;
  orderId: string;
  orderDescription?: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export interface NowPaymentsInvoice {
  id: string;
  invoice_url: string;
  order_id: string;
  price_amount: string | number;
  price_currency: string;
  created_at?: string;
}

export class NowPaymentsError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function createNowPaymentsInvoice(
  input: CreateNowPaymentsInvoiceInput,
): Promise<NowPaymentsInvoice> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    throw new NowPaymentsError("NOWPAYMENTS_API_KEY is not configured.");
  }

  if (
    input.priceAmount == null ||
    !Number.isFinite(input.priceAmount) ||
    input.priceAmount <= 0
  ) {
    throw new NowPaymentsError("priceAmount must be a positive number.");
  }

  const body = {
    price_amount: Number(input.priceAmount.toFixed(2)),
    price_currency: input.priceCurrency.toLowerCase(),
    order_id: input.orderId,
    order_description: input.orderDescription ?? `Order ${input.orderId}`,
    ipn_callback_url: input.ipnCallbackUrl,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    is_fee_paid_by_user: false,
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
  };

  const res = await fetch(`${NOWPAYMENTS_API_BASE}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new NowPaymentsError(
      `NOWPayments /invoice failed (${res.status}): ${text}`,
      res.status,
      text,
    );
  }

  const json = (await res.json()) as Partial<NowPaymentsInvoice>;
  if (!json.id || !json.invoice_url) {
    throw new NowPaymentsError("NOWPayments returned no invoice URL.");
  }
  return json as NowPaymentsInvoice;
}

/**
 * Sortera object keys rekursivt (NOWPayments HMAC kräver det).
 */
function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return obj;
}

/**
 * Verifierar `x-nowpayments-sig` mot HMAC-SHA512 av JSON.stringify av
 * sorterad payload.
 *
 * MUST be called with the raw request body (request.text()) parsed once
 * — vi parser:ar JSON för att kunna sortera keys, men vi flippar inte
 * payment-status om signaturen är ogiltig.
 */
export function verifyNowPaymentsSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  ipnSecret: string,
): boolean {
  if (!signatureHeader || !ipnSecret) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const sorted = sortObjectKeys(parsed);
  const serialized = JSON.stringify(sorted);
  const expected = createHmac("sha512", ipnSecret).update(serialized).digest("hex");

  if (signatureHeader.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signatureHeader, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * NOWPayments payment_status → vårt orders.payment_status.
 * - finished/confirmed → paid
 * - partially_paid → partially_paid (still pending tills delsumma fixad manuellt)
 * - failed/expired/refunded → failed
 * - waiting/sending/confirming → pending
 */
export function mapNowPaymentsStatus(s: string | undefined): "paid" | "pending" | "failed" {
  switch (s) {
    case "finished":
    case "confirmed":
      return "paid";
    case "failed":
    case "expired":
    case "refunded":
      return "failed";
    default:
      return "pending";
  }
}
