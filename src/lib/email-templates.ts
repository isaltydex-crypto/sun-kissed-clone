// ============================================================================
// Tiny template renderer for notification emails.
//   - {{var}}  →  vars[var] (HTML-escaped in HTML output, raw in text output)
//   - Newlines preserved in HTML output
//   - Wraps body in a branded HTML shell (header + footer)
// ============================================================================
import type { SiteDefaults } from "@/lib/site-defaults";

export type EmailTemplates = SiteDefaults["emails"];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyVars(template: string, vars: Record<string, string>, escape: (s: string) => string): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v == null ? "" : escape(v);
  });
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderEmail(
  templates: EmailTemplates,
  kind: "contact" | "alert",
  vars: Record<string, string>,
): RenderedEmail {
  const subjectTpl = kind === "contact" ? templates.contactSubject : templates.alertSubject;
  const bodyTpl = kind === "contact" ? templates.contactBody : templates.alertBody;

  const subject = applyVars(subjectTpl, vars, (s) => s);
  const text = applyVars(bodyTpl, vars, (s) => s);
  const bodyHtml = applyVars(bodyTpl, vars, escapeHtml).replace(/\n/g, "<br>");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <tr><td style="padding:18px 28px;background:#0a3d4a;color:#ffffff;font-weight:600;letter-spacing:0.02em">
      ${escapeHtml(templates.brandHeader)}
    </td></tr>
    <tr><td style="padding:28px;font-size:14px;line-height:1.6">
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f5f5f4;font-size:12px;color:#78716c;border-top:1px solid #e7e5e4">
      ${escapeHtml(templates.footer)}
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}
