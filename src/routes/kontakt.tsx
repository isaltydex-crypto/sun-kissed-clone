import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Clock } from "lucide-react";

export const Route = createFileRoute("/kontakt")({
  head: () => ({
    meta: [
      { title: "Kontakt — Peptida" },
      { name: "description", content: "Kontakta Peptidas kundservice. Vi finns här mån–fre 9–17." },
      { property: "og:title", content: "Kontakt — Peptida" },
      { property: "og:description", content: "Kontakta Peptidas kundservice — vi svarar inom 24 timmar." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <>
      <section className="bg-ocean py-16 text-primary-foreground md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <h1 className="text-4xl font-bold md:text-5xl">Kontakta oss</h1>
          <p className="mt-3 text-primary-foreground/80">Vi svarar normalt inom 24 timmar på vardagar.</p>
        </div>
      </section>
      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-12 px-4 md:grid-cols-2 md:px-8">
          <div className="space-y-6">
            <div className="flex gap-4">
              <Mail className="h-6 w-6 flex-shrink-0 text-sun-deep" />
              <div>
                <h3 className="font-semibold text-ocean">E-post</h3>
                <p className="text-muted-foreground">hej@peptida.se</p>
              </div>
            </div>
            <div className="flex gap-4">
              <MapPin className="h-6 w-6 flex-shrink-0 text-sun-deep" />
              <div>
                <h3 className="font-semibold text-ocean">Adress</h3>
                <p className="text-muted-foreground">Götgatan 12<br />118 46 Stockholm</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Clock className="h-6 w-6 flex-shrink-0 text-sun-deep" />
              <div>
                <h3 className="font-semibold text-ocean">Öppettider</h3>
                <p className="text-muted-foreground">Mån–fre 9:00–17:00</p>
              </div>
            </div>
          </div>
          <form className="space-y-4 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]" onSubmit={(e) => { e.preventDefault(); alert("Tack! Vi hör av oss snart."); }}>
            <div>
              <label className="block text-sm font-medium text-foreground">Namn</label>
              <input required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">E-post</label>
              <input type="email" required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Meddelande</label>
              <textarea required rows={5} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean" />
            </div>
            <button type="submit" className="w-full rounded-lg bg-ocean py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean-deep">
              Skicka meddelande
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
