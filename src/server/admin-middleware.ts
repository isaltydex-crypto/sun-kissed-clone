import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader, getCookie } from "@tanstack/react-start/server";

export const adminAuthMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    let pw = "";
    if (typeof window !== "undefined") {
      try {
        pw = sessionStorage.getItem("peptivalab.admin.pw.v1") || "";
      } catch {
        // ignore
      }
    }
    return next({
      headers: pw ? { "x-admin-password": pw } : {},
    });
  })
  .server(async ({ next }) => {
    const fromHeader = getRequestHeader("x-admin-password") || "";
    const fromCookie = getCookie("pvl_admin") || "";
    const provided = fromHeader || fromCookie;
    const expected = process.env.ADMIN_CHAT_PASSWORD || "peptiva-admin-2026";
    if (!provided || provided !== expected) {
      throw new Error("Unauthorized");
    }
    return next();
  });
