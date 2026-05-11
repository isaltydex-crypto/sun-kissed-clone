/**
 * Helpers for the Paymento callback signature.
 *
 * Paymento signs each callback with HMAC-SHA256 of the raw request body
 * using the merchant's secret key. The signature is sent as UPPERCASE hex
 * in the `X-Hmac-Sha256-Signature` header.
 *
 * Docs: https://docs.paymento.io/api-documention/payment-callback
 */
import { createHmac, timingSafeEqual } from "crypto";

export function paymentoSign(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex").toUpperCase();
}

export function verifyPaymentoSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = paymentoSign(rawBody, secret);
  const received = signatureHeader.trim().toUpperCase();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Paymento OrderStatus enum (from the callback body).
 *   0 Initialize, 1 Pending, 2 PartialPaid, 3 WaitingToConfirm,
 *   4 Timeout,    5 UserCanceled, 7 Paid, 8 Approve, 9 Reject
 */
export function mapPaymentoStatus(s: number): "pending" | "paid" | "failed" {
  switch (s) {
    case 7: // Paid (confirmed on chain)
    case 8: // Approve (verified by store)
      return "paid";
    case 4: // Timeout
    case 5: // UserCanceled
    case 9: // Reject
      return "failed";
    default:
      return "pending";
  }
}
