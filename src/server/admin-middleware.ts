import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

const SESSION_COOKIE = "pvl_admin_session";
const LEGACY_COOKIE = "pvl_admin";
const FALLBACK_PASSWORD = "peptiva-admin-2026";

export const adminAuthMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    // Cookie is HttpOnly so we can't read it from JS — just send the request.
    // If unauthorized, redirect to login.
    try {
      return await next();
    } catch (err) {
      const msg = (err as Error)?.message || "";
      if (/unauthorized/i.test(msg)) {
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
          const here = window.location.pathname + window.location.search;
          window.location.href = `/admin/login?redirect=${encodeURIComponent(here)}`;
        }
      }
      throw err;
    }
  })
  .server(async ({ next }) => {
    const { verifyAdminSession } = await import("@/lib/admin-auth.server");
    const sessionToken = getCookie(SESSION_COOKIE);
    if (verifyAdminSession(sessionToken)) {
      return next();
    }
    // Legacy fallback: tolerate the old plaintext cookie for one rollover so
    // existing browser sessions don't get bounced. Remove after a few days.
    const legacy = getCookie(LEGACY_COOKIE) || "";
    const expected = process.env.ADMIN_CHAT_PASSWORD || FALLBACK_PASSWORD;
    if (legacy && legacy === expected) {
      return next();
    }
    throw new Error("Unauthorized");
  });
