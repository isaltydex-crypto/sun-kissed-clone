/**
 * Client-safe entry point for admin auth server functions.
 * All node-only logic lives in ./admin-auth.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getCookie,
  getRequestHeader,
  getRequestIP,
  setCookie,
} from "@tanstack/react-start/server";

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
    const {
      SESSION_COOKIE,
      SESSION_TTL_SECONDS,
      consumeAttempt,
      logAdminAction,
      verifyPassword,
      signSession,
      newNonce,
    } = await import("./admin-auth.server");
    const { verifyTotp } = await import("./admin-2fa.functions");

    const ip = getRequestIP({ xForwardedFor: true }) || "unknown";
    const userAgent = getRequestHeader("user-agent") || undefined;

    if (!consumeAttempt(ip)) {
      await logAdminAction({ action: "admin.login.rate_limited", ip, userAgent });
      throw new Error("För många försök, försök igen om en stund.");
    }

    const totpRequired = Boolean(process.env.ADMIN_TOTP_SECRET);
    if (totpRequired) {
      if (!data.code) throw new Error("2FA-kod krävs.");
      await verifyTotp({ data: { code: data.code } });
    }

    const ok = await verifyPassword(data.password);
    if (!ok) {
      await logAdminAction({ action: "admin.login.failed", ip, userAgent });
      await new Promise((r) => setTimeout(r, 350));
      throw new Error("Fel lösenord.");
    }

    const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
    const token = signSession(expiresAt, newNonce());

    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    await logAdminAction({ action: "admin.login.success", ip, userAgent });
    return { ok: true, expiresAt };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { SESSION_COOKIE, logAdminAction } = await import("./admin-auth.server");
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
  const { SESSION_COOKIE, verifyAdminSession } = await import("./admin-auth.server");
  const token = getCookie(SESSION_COOKIE);
  return { authenticated: verifyAdminSession(token) };
});

export const hashPassword = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ password: z.string().min(8).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { SESSION_COOKIE, verifyAdminSession, hashPasswordPlain } = await import(
      "./admin-auth.server"
    );
    const token = getCookie(SESSION_COOKIE);
    if (!verifyAdminSession(token)) {
      throw new Error("Endast inloggad admin kan skapa hash.");
    }
    const hash = await hashPasswordPlain(data.password);
    return { hash };
  });
