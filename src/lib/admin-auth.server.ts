/**
 * Server-only helpers for admin auth. Kept out of *.functions.ts so node
 * built-ins (crypto, bcryptjs) never end up in the client bundle.
 */
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const SESSION_COOKIE = "pvl_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

function sessionSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET || "";
  if (!s || s.length < 32) {
    return "insecure-dev-fallback-please-set-ADMIN_SESSION_SECRET-32+chars";
  }
  return s;
}

export function signSession(expiresAt: number, nonce: string): string {
  const payload = `${expiresAt}.${nonce}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyAdminSession(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiresAtStr, nonce, sig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = createHmac("sha256", sessionSecret())
    .update(`${expiresAtStr}.${nonce}`)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function newNonce(): string {
  return randomBytes(16).toString("hex");
}

export async function verifyPassword(plain: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash && hash.startsWith("$2")) {
    return bcrypt.compare(plain, hash);
  }
  const expected = process.env.ADMIN_CHAT_PASSWORD || "peptiva-admin-2026";
  if (!plain || plain.length === 0) return false;
  const a = Buffer.from(plain);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function hashPasswordPlain(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

// Per-IP token bucket
const buckets = new Map<string, { tokens: number; updatedAt: number }>();
const BUCKET_CAPACITY = 8;
const BUCKET_REFILL_PER_SEC = 8 / 60;

export function consumeAttempt(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip) || { tokens: BUCKET_CAPACITY, updatedAt: now };
  const elapsedSec = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(BUCKET_CAPACITY, b.tokens + elapsedSec * BUCKET_REFILL_PER_SEC);
  b.updatedAt = now;
  if (b.tokens < 1) {
    buckets.set(ip, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(ip, b);
  return true;
}

setInterval(() => {
  const cutoff = Date.now() - 1000 * 60 * 30;
  for (const [k, v] of buckets) if (v.updatedAt < cutoff) buckets.delete(k);
}, 1000 * 60 * 5).unref?.();

export async function logAdminAction(input: {
  action: string;
  target?: string;
  detail?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  try {
    await supabaseAdmin.from("admin_actions").insert({
      action: input.action,
      target: input.target ?? null,
      detail: (input.detail ?? {}) as never,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch (err) {
    console.error("admin audit log failed", err);
  }
}
