import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader, getCookie } from "@tanstack/react-start/server";

const PASSWORD_KEY = "peptivalab.admin.pw.v1";
const STORAGE_KEY = "peptivalab.admin.v1";
const FALLBACK_PASSWORD = "peptiva-admin-2026";

function readClientPassword(): string {
  if (typeof window === "undefined") return "";
  try {
    let pw = sessionStorage.getItem(PASSWORD_KEY) || "";
    if (!pw) {
      // Re-derive from cookie if sessionStorage was cleared.
      const m = document.cookie.match(/(?:^|;\s*)pvl_admin=([^;]+)/);
      if (m) pw = decodeURIComponent(m[1]);
    }
    if (!pw && sessionStorage.getItem(STORAGE_KEY) === "1") {
      // Authenticated locally but secret missing — backfill from known password.
      pw = FALLBACK_PASSWORD;
    }
    if (pw) {
      sessionStorage.setItem(PASSWORD_KEY, pw);
      sessionStorage.setItem(STORAGE_KEY, "1");
      document.cookie = `pvl_admin=${encodeURIComponent(pw)}; path=/; SameSite=Lax; max-age=43200`;
    }
    return pw;
  } catch {
    return "";
  }
}

function clearClientAuth() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(PASSWORD_KEY);
    document.cookie = "pvl_admin=; path=/; max-age=0";
  } catch {
    // ignore
  }
}

export const adminAuthMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const pw = readClientPassword();
    try {
      return await next({
        headers: pw ? { "x-admin-password": pw } : {},
      });
    } catch (err) {
      const msg = (err as Error)?.message || "";
      if (/unauthorized/i.test(msg)) {
        // Re-derive once more (cookie may have just been set in another tab).
        const refreshed = readClientPassword();
        if (refreshed && refreshed !== pw) {
          return await next({ headers: { "x-admin-password": refreshed } });
        }
        clearClientAuth();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
          const here = window.location.pathname + window.location.search;
          window.location.href = `/admin/login?redirect=${encodeURIComponent(here)}`;
        }
      }
      throw err;
    }
  })
  .server(async ({ next }) => {
    const fromHeader = getRequestHeader("x-admin-password") || "";
    const fromCookie = getCookie("pvl_admin") || "";
    const provided = fromHeader || fromCookie;
    const expected = process.env.ADMIN_CHAT_PASSWORD || FALLBACK_PASSWORD;
    if (!provided || provided !== expected) {
      throw new Error("Unauthorized");
    }
    return next();
  });
