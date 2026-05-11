// ============================================================================
// Order confirmation email — renders HTML + text for a single order and
// dispatches via Brevo. Customer gets the receipt; admin (NOTIFY_EMAIL_TO)
// gets a BCC copy when configured.
// ============================================================================
import { sendBrevoEmail } from "./brevo.server";

interface OrderEmailItem {
  productName: string;
  quantity: number;
  unitPriceOre: number;
}

export interface OrderEmailInput {
  orderNumber: string;
  customer: { email: string; name: string };
  items: OrderEmailItem[];
  subtotalOre: number;
  shippingOre: number;
  discountOre: number;
  totalOre: number;
  currency: string;
  brand?: { name?: string; header?: string; footer?: string };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(ore: number, currency: string): string {
  return `${(ore / 100).toLocaleString("sv-SE", { minimumFractionDigits: 0 })} ${currency}`;
}

export function renderOrderEmail(input: OrderEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const brandName = input.brand?.name || "peptivaLab Group";
  const brandHeader = input.brand?.header || brandName;
  const brandFooter =
    input.brand?.footer || `${brandName} • Tack för att du handlar hos oss`;

  const subject = `Orderbekräftelse ${input.orderNumber} — ${brandName}`;

  const itemsHtml = input.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;color:#1c1917">${i.quantity} × ${escapeHtml(i.productName)}</td>
        <td style="padding:8px 0;text-align:right;color:#0a3d4a;font-weight:600">${fmt(i.unitPriceOre * i.quantity, input.currency)}</td>
      </tr>`,
    )
    .join("");

  const discountRow =
    input.discountOre > 0
      ? `<tr><td style="padding:4px 0;color:#0a3d4a">Rabatt</td><td style="padding:4px 0;text-align:right;color:#0a3d4a">−${fmt(input.discountOre, input.currency)}</td></tr>`
      : "";

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <tr><td style="padding:20px 28px;background:#0a3d4a;color:#ffffff;font-weight:600;letter-spacing:0.02em">${escapeHtml(brandHeader)}</td></tr>
    <tr><td style="padding:28px;font-size:14px;line-height:1.6">
      <h1 style="margin:0 0 8px;font-size:22px;color:#0a3d4a">Tack för din beställning!</h1>
      <p style="margin:0 0 4px">Hej ${escapeHtml(input.customer.name)},</p>
      <p style="margin:0 0 20px">Vi har tagit emot din order. Här är en sammanställning:</p>
      <p style="margin:0 0 16px;font-size:13px;color:#78716c">Ordernummer: <strong style="font-family:ui-monospace,monospace;color:#0a3d4a">${escapeHtml(input.orderNumber)}</strong></p>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #e7e5e4;border-bottom:1px solid #e7e5e4;margin:16px 0">
        ${itemsHtml}
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;margin-top:12px">
        <tr><td style="padding:4px 0;color:#78716c">Delsumma</td><td style="padding:4px 0;text-align:right">${fmt(input.subtotalOre, input.currency)}</td></tr>
        <tr><td style="padding:4px 0;color:#78716c">Frakt</td><td style="padding:4px 0;text-align:right">${input.shippingOre === 0 ? "Fri" : fmt(input.shippingOre, input.currency)}</td></tr>
        ${discountRow}
        <tr><td style="padding:10px 0 0;border-top:1px solid #e7e5e4;font-weight:700;color:#0a3d4a">Totalt</td><td style="padding:10px 0 0;border-top:1px solid #e7e5e4;text-align:right;font-weight:700;color:#0a3d4a">${fmt(input.totalOre, input.currency)}</td></tr>
      </table>

      <p style="margin:24px 0 0;color:#78716c;font-size:13px">Har du frågor? Svara på det här mailet så återkommer vi.</p>
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f5f5f4;font-size:12px;color:#78716c;border-top:1px solid #e7e5e4">${escapeHtml(brandFooter)}</td></tr>
  </table>
</body></html>`;

  const text = [
    `Tack för din beställning!`,
    ``,
    `Hej ${input.customer.name},`,
    `Vi har tagit emot din order. Ordernummer: ${input.orderNumber}`,
    ``,
    ...input.items.map((i) => `  ${i.quantity} × ${i.productName} — ${fmt(i.unitPriceOre * i.quantity, input.currency)}`),
    ``,
    `Delsumma: ${fmt(input.subtotalOre, input.currency)}`,
    `Frakt:    ${input.shippingOre === 0 ? "Fri" : fmt(input.shippingOre, input.currency)}`,
    ...(input.discountOre > 0 ? [`Rabatt:   −${fmt(input.discountOre, input.currency)}`] : []),
    `Totalt:   ${fmt(input.totalOre, input.currency)}`,
    ``,
    brandFooter,
  ].join("\n");

  return { subject, html, text };
}

export async function sendOrderConfirmationEmail(input: OrderEmailInput): Promise<boolean> {
  const rendered = renderOrderEmail(input);
  // Admin recipients receive a BCC copy of every order confirmation.
  // Defaults can be overridden via NOTIFY_EMAIL_TO (comma-separated).
  const adminList =
    process.env.NOTIFY_EMAIL_TO ?? "logistic.plq@proton.me, it.plg@proton.me";
  const adminEmails = adminList
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  // Prefer SMTP (e.g. Brevo SMTP relay) when SMTP_HOST is configured —
  // fully independent of Lovable Cloud. Fall back to Brevo REST API.
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const { sendNotification } = await import("./notify.server");
    return sendNotification({
      to: input.customer.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      // notify.server.ts uses a single "to"; pass admin BCC via header-less
      // approach by sending a separate admin copy.
    }).then(async (ok) => {
      if (ok && adminEmails.length) {
        await sendNotification({
          to: adminEmails.join(", "),
          subject: `[admin] ${rendered.subject}`,
          text: rendered.text,
          html: rendered.html,
        });
      }
      return ok;
    });
  }

  return sendBrevoEmail({
    to: [{ email: input.customer.email, name: input.customer.name }],
    bcc: adminEmails.map((email) => ({ email })),
    subject: rendered.subject,
    htmlContent: rendered.html,
    textContent: rendered.text,
  });
}
