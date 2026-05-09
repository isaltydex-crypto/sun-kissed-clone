/**
 * Helpers for the NOWPayments IPN webhook signature.
 * NOWPayments signs the body with HMAC-SHA512 of the JSON payload with all
 * object keys sorted alphabetically (recursively), using the IPN secret.
 */
import { createHmac, timingSafeEqual } from "crypto";

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

export function nowpaymentsSign(payload: unknown, secret: string): string {
  const sortedJson = JSON.stringify(sortKeys(payload));
  return createHmac("sha512", secret).update(sortedJson).digest("hex");
}

export function verifyNowpaymentsSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const expected = nowpaymentsSign(parsed, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
