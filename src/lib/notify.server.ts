// ============================================================================
// Email notification helper. Server-only — uses SMTP via nodemailer.
//
// Configure with env vars:
//   SMTP_HOST          smtp.example.com
//   SMTP_PORT          587 (default) | 465 | 25
//   SMTP_SECURE        true | false (default: true if port=465, else false)
//   SMTP_USER          login
//   SMTP_PASS          password
//   NOTIFY_EMAIL_FROM  "PeptivaLab <noreply@peptivalab.se>"
//   NOTIFY_EMAIL_TO    where notifications are sent (comma-separated allowed)
//
// All sends are best-effort: failures are logged and swallowed so a broken
// SMTP config never blocks a user-facing action (e.g. contact form submit).
// ============================================================================
import nodemailer, { type Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;
let cachedKey = "";

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE != null
      ? process.env.SMTP_SECURE === "true"
      : port === 465;

  const key = `${host}|${port}|${secure}|${user}`;
  if (cachedTransporter && cachedKey === key) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  cachedKey = key;
  return cachedTransporter;
}

export interface NotifyInput {
  subject: string;
  text: string;
  html?: string;
  to?: string; // override NOTIFY_EMAIL_TO
  replyTo?: string;
}

export async function sendNotification(input: NotifyInput): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[notify] SMTP not configured — skipping email:", input.subject);
    return false;
  }
  const to = input.to || process.env.NOTIFY_EMAIL_TO;
  if (!to) {
    console.warn("[notify] NOTIFY_EMAIL_TO not set — skipping email:", input.subject);
    return false;
  }
  const from =
    process.env.NOTIFY_EMAIL_FROM ||
    process.env.SMTP_USER ||
    "noreply@localhost";

  try {
    await transporter.sendMail({
      from,
      to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return true;
  } catch (err) {
    console.error("[notify] sendMail failed:", err);
    return false;
  }
}
