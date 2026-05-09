/**
 * Server-side admin authentication.
 *
 * - Verifies password against ADMIN_PASSWORD_HASH (bcrypt) when set,
 *   otherwise falls back to plaintext ADMIN_CHAT_PASSWORD for backwards
 *   compatibility.
 * - Issues an HMAC-signed session token stored in an HttpOnly+Secure cookie.
 * - Per-IP token bucket throttles brute-force attempts on adminLogin.
 * - Writes audit-log rows for every login attempt and admin action.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getCookie,
  getRequestHeader,
  getRequestIP,
  setCookie,
} from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyTotp } from "./admin-2fa.functions";

const SESSION_COOKIE = "pvl_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

function sessionSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET || "";
  if (!s || s.length < 32) {
    // Fall back to a derived value so dev doesn't crash, but log loudly.
    return "insecure-dev-fallback-please-set-ADMIN_SESSION_SECRET-32+chars";
  }
  return s;
}

function signSession(expiresAt: number, nonce: string): string {
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

async function verifyPassword(plain: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash && hash.startsWith("$2")) {
    return bcrypt.compare(plain, hash);
  }
  // Legacy plaintext fallback — ok for dev, warn on prod
  const expected = process.env.ADMIN_CHAT_PASSWORD || "peptiva-admin-2026";
  if (!plain || plain.length === 0) return false;
  // Use timing-safe compare even for plaintext
  const a = Buffer.from(plain);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// -----------------------------------------------------------------------------
// In-memory token bucket per IP — best-effort brute-force throttle.
// Resets on container restart and is per-instance (single-replica VPS).
// -----------------------------------------------------------------------------
const buckets = new Map<string, { tokens: number; updatedAt: number }>();
const BUCKET_CAPACITY = 8; // 8 attempts...
const BUCKET_REFILL_PER_SEC = 8 / 60; // ...refilled in ~60s

function consumeAttempt(ip: string): boolean {
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

// Periodically GC old buckets to avoid memory growth.
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
    // Never let logging failures break the main flow.
    console.error("admin audit log failed", err);
  }
}

// -----------------------------------------------------------------------------
// Server functions
// -----------------------------------------------------------------------------

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        password: z.string().min(1).max(200),
        code: z.string().regex(/^\d{6}$/).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) || "unknown";
    const userAgent = getRequestHeader("user-agent") || undefined;

    if (!consumeAttempt(ip)) {
      await logAdminAction({
        action: "admin.login.rate_limited",
        ip,
        userAgent,
      });
      throw new Error("För många försök, försök igen om en stund.");
    }

    const totpRequired = Boolean(process.env.ADMIN_TOTP_SECRET);
    if (totpRequired) {
      if (!data.code) throw new Error("2FA-kod krävs.");
      // verifyTotp throws on invalid
      await verifyTotp({ data: { code: data.code } });
    }

    const ok = await verifyPassword(data.password);
    if (!ok) {
      await logAdminAction({
        action: "admin.login.failed",
        ip,
        userAgent,
      });
      // Constant-ish delay to slow down attackers
      await new Promise((r) => setTimeout(r, 350));
      throw new Error("Fel lösenord.");
    }

    const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
    const nonce = randomBytes(16).toString("hex");
    const token = signSession(expiresAt, nonce);

    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    await logAdminAction({
      action: "admin.login.success",
      ip,
      userAgent,
    });

    return { ok: true, expiresAt };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const ip = getRequestIP({ xForwardedFor: true }) || undefined;
  const userAgent = getRequestHeader("user-agent") || undefined;
  setCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  await logAdminAction({ action: "admin.logout", ip, userAgent });
  return { ok: true };
});

export const adminSessionStatus = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE);
  return { authenticated: verifyAdminSession(token) };
});

// Helper for other server functions/middleware (server-only export).
export function readAdminSessionFromRequest(): boolean {
  const token = getCookie(SESSION_COOKIE);
  return verifyAdminSession(token);
}

// Generate a bcrypt hash for setup. Anyone can call (no auth) because they
// must already have shell access to read the result; useful for the
// /admin/sakerhet helper UI which itself is auth-gated.
export const hashPassword = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ password: z.string().min(8).max(200) }).parse(input))
  .handler(async ({ data }) => {
    if (!readAdminSessionFromRequest()) {
      throw new Error("Endast inloggad admin kan skapa hash.");
    }
    const hash = await bcrypt.hash(data.password, 12);
    return { hash };
  });
