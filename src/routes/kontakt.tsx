import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mail, MapPin, Clock } from "lucide-react";
import { useState } from "react";
import { useSiteContent } from "@/context/SiteContentContext";
import { submitContact } from "@/lib/contact.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/kontakt")({
  head: () => ({
    meta: [
      { title: "Kontakt — PeptivaLab Group" },
      { name: "description", content: "Kontakta PeptivaLab Groups kundservice." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const c = useSiteContent().contact;
  const submit = useServerFn(submitContact);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submit({ data: form });
      toast.success("Tack! Vi hör av oss snart.");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte skicka meddelandet. Försök igen senare.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="bg-ocean py-16 text-primary-foreground md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <h1 className="text-4xl font-bold md:text-5xl">{c.heroTitle}</h1>
          <p className="mt-3 text-primary-foreground/80">{c.heroSubtitle}</p>
        </div>
      </section>
      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-12 px-4 md:grid-cols-2 md:px-8">
          <div className="space-y-6">
            <div className="flex gap-4">
              <Mail className="h-6 w-6 flex-shrink-0 text-sun-deep" />
              <div>
                <h3 className="font-semibold text-ocean">E-post</h3>
                <p className="text-muted-foreground">{c.email}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <MapPin className="h-6 w-6 flex-shrink-0 text-sun-deep" />
              <div>
                <h3 className="font-semibold text-ocean">Adress</h3>
                <p className="whitespace-pre-wrap text-muted-foreground">{c.address}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Clock className="h-6 w-6 flex-shrink-0 text-sun-deep" />
              <div>
                <h3 className="font-semibold text-ocean">Öppettider</h3>
                <p className="text-muted-foreground">{c.hours}</p>
              </div>
            </div>
          </div>
          <form className="space-y-4 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="contact-name">Namn</label>
              <input id="contact-name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="contact-email">E-post</label>
              <input id="contact-email" type="email" required maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground" htmlFor="contact-message">Meddelande</label>
              <textarea id="contact-message" required rows={5} maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
            </div>
            <button type="submit" disabled={submitting} className="w-full rounded-lg bg-ocean py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean-deep disabled:opacity-60">
              {submitting ? "Skickar…" : "Skicka meddelande"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
