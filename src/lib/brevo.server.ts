// ============================================================================
// Brevo email sender — server-only. Calls Brevo's transactional email API
// directly (no Lovable gateway). Requires BREVO_DIRECT_API_KEY env var
// containing your raw Brevo API key (xkeysib-...) from app.brevo.com.
// ============================================================================

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export interface BrevoRecipient {
  email: string;
  name?: string;
}

export interface BrevoSendInput {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  cc?: BrevoRecipient[];
  bcc?: BrevoRecipient[];
  replyTo?: BrevoRecipient;
  sender?: BrevoRecipient;
}

function parseSender(raw: string | undefined): BrevoRecipient | null {
  if (!raw) return null;
  const m = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1] || undefined, email: m[2] };
  if (raw.includes("@")) return { email: raw.trim() };
  return null;
}

export async function sendBrevoEmail(input: BrevoSendInput): Promise<boolean> {
  // Prefer the direct key; fall back to the connector-gateway key name for
  // backward compatibility if someone manually set it to a raw Brevo key.
  const apiKey = process.env.BREVO_DIRECT_API_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[brevo] BREVO_DIRECT_API_KEY missing — skipping email:", input.subject);
    return false;
  }

  const sender =
    input.sender ||
    parseSender(process.env.NOTIFY_EMAIL_FROM) ||
    parseSender(process.env.SMTP_USER) ||
    { email: "noreply@localhost" };

  const body = {
    sender,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    replyTo: input.replyTo,
    subject: input.subject,
    htmlContent: input.htmlContent,
    textContent: input.textContent,
  };

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`[brevo] send failed [${res.status}]: ${txt}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[brevo] send error:", err);
    return false;
  }
}
