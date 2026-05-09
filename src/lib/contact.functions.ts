import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendNotification } from "./notify.server";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Namn krävs").max(100),
  email: z.string().trim().email("Ogiltig e-post").max(255),
  message: z.string().trim().min(1, "Meddelande krävs").max(2000),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const { name, email, message } = data;

    const text = [
      `Nytt meddelande från kontaktformuläret`,
      ``,
      `Namn:    ${name}`,
      `E-post:  ${email}`,
      ``,
      `Meddelande:`,
      message,
    ].join("\n");

    const html = `
      <h2>Nytt meddelande från kontaktformuläret</h2>
      <p><strong>Namn:</strong> ${escapeHtml(name)}</p>
      <p><strong>E-post:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      <p><strong>Meddelande:</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit;background:#f6f6f6;padding:12px;border-radius:6px">${escapeHtml(message)}</pre>
    `;

    const sent = await sendNotification({
      subject: `Kontaktformulär: ${name}`,
      text,
      html,
      replyTo: email,
    });

    return { ok: true, emailed: sent };
  });
