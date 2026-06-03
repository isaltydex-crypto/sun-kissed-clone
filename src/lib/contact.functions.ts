import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendNotification } from "./notify.server";
import { renderEmail } from "./email-templates";
import { mergeContent, type SiteContentMap } from "@/lib/site-defaults";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Namn krävs").max(100),
  email: z.string().trim().email("Ogiltig e-post").max(255),
  message: z.string().trim().min(1, "Meddelande krävs").max(2000),
});

async function loadEmailTemplates() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("site_content").select("key,value");
  const stored: SiteContentMap = {};
  for (const row of data ?? []) {
    (stored as Record<string, unknown>)[row.key] = row.value as unknown;
  }
  return mergeContent(stored).emails;
}

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const templates = await loadEmailTemplates();
    const rendered = renderEmail(templates, "contact", {
      name: data.name,
      email: data.email,
      message: data.message,
      timestamp: new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" }),
    });

    const sent = await sendNotification({
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      replyTo: data.email,
    });

    return { ok: true, emailed: sent };
  });
