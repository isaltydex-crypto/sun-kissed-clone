// ============================================================================
// Brevo email sender — server-only. Calls Brevo's transactional email API via
// the Lovable connector gateway. Both LOVABLE_API_KEY and BREVO_API_KEY are
// injected automatically when the Brevo connector is linked.
// ============================================================================

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";

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
  // Match "Name <email@host>"
  const m = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1] || undefined, email: m[2] };
  if (raw.includes("@")) return { email: raw.trim() };
  return null;
}

export async function sendBrevoEmail(input: BrevoSendInput): Promise<boolean> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;
  if (!lovableKey) {
    console.warn("[brevo] LOVABLE_API_KEY missing — skipping email:", input.subject);
    return false;
  }
  if (!brevoKey) {
    console.warn("[brevo] BREVO_API_KEY missing — skipping email:", input.subject);
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
    const res = await fetch(`${GATEWAY_URL}/smtp/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": brevoKey,
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
