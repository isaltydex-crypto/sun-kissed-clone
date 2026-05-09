import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server function: report whether TOTP is required and verify a code.
// Reads process.env.ADMIN_TOTP_SECRET inside handlers (do not read at module top-level).

export const getTotpStatus = createServerFn({ method: "GET" }).handler(async () => {
  const secret = process.env.ADMIN_TOTP_SECRET;
  return { required: Boolean(secret && secret.trim().length >= 16) };
});

export const verifyTotp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ code: z.string().trim().regex(/^\d{6}$/, "6-siffrig kod krävs") }).parse(input),
  )
  .handler(async ({ data }) => {
    const secret = process.env.ADMIN_TOTP_SECRET;
    if (!secret) return { ok: true, skipped: true as const };
    const { authenticator } = await import("otplib");
    authenticator.options = { window: 1 };
    const ok = authenticator.verify({ token: data.code, secret });
    if (!ok) {
      throw new Error("Ogiltig 2FA-kod");
    }
    return { ok: true, skipped: false as const };
  });

// Generate a fresh secret + otpauth URL + QR data URL.
// Protected by the existing admin password cookie (pvl_admin) so only an
// authenticated admin can rotate the seed. The new secret is NOT stored —
// the admin must paste it into ADMIN_TOTP_SECRET in their .env and restart.
export const generateTotpSetup = createServerFn({ method: "POST" }).handler(async () => {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const cookie = getRequestHeader("cookie") || "";
  const expected = process.env.ADMIN_CHAT_PASSWORD || "";
  const match = cookie.match(/(?:^|;\s*)pvl_admin=([^;]+)/);
  const provided = match ? decodeURIComponent(match[1]) : "";
  if (!expected || provided !== expected) {
    throw new Error("Endast inloggad admin kan generera 2FA-secret.");
  }

  const { authenticator } = await import("otplib");
  const QRCode = (await import("qrcode")).default;

  const secret = authenticator.generateSecret(32);
  const issuer = process.env.ADMIN_TOTP_ISSUER || "PeptivaLab";
  const account = process.env.ADMIN_TOTP_ACCOUNT || "admin";
  const otpauth = authenticator.keyuri(account, issuer, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  return { secret, otpauth, qrDataUrl };
});
