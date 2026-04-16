import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Vanliga frågor — Soldis" },
      { name: "description", content: "Svar på de vanligaste frågorna om Soldis självbruna produkter, leverans och retur." },
      { property: "og:title", content: "Vanliga frågor — Soldis" },
      { property: "og:description", content: "Svar på de vanligaste frågorna om Soldis självbruna produkter." },
    ],
  }),
  component: FaqPage,
});

const faqs = [
  { q: "Hur lång tid tar leveransen?", a: "Vi skickar samma dag om du beställer före kl 14. Leverans tar normalt 1–3 arbetsdagar inom Sverige." },
  { q: "Är produkterna veganska?", a: "Ja, alla våra produkter är 100% veganska och cruelty-free. Vi testar aldrig på djur." },
  { q: "Hur länge håller solbrännan?", a: "Med rätt förberedelse och underhåll håller färgen i 5–7 dagar och bleknar sedan jämnt." },
  { q: "Kan jag returnera produkten?", a: "Vi erbjuder 30 dagars öppet köp. Oöppnade produkter kan returneras för full återbetalning." },
  { q: "Vilka betalningssätt accepterar ni?", a: "Vi tar emot Klarna (faktura och delbetalning), Swish, samt kort via Visa, Mastercard och Amex." },
  { q: "Är produkterna säkra för känslig hud?", a: "Ja, samtliga produkter är dermatologiskt testade och fria från parabener, mineraloljor och parfym." },
];

function FaqPage() {
  return (
    <>
      <section className="bg-ocean py-16 text-primary-foreground md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <h1 className="text-4xl font-bold md:text-5xl">Vanliga frågor</h1>
          <p className="mt-3 text-primary-foreground/80">Hittar du inte svaret? Kontakta oss så hjälper vi dig.</p>
        </div>
      </section>
      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base font-semibold text-ocean">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  );
}
