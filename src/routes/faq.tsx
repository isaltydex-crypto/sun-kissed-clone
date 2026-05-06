import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Vanliga frågor — PeptivaLab Group" },
      { name: "description", content: "Svar på de vanligaste frågorna om PeptivaLab Groups peptidhudvård, leverans och retur." },
      { property: "og:title", content: "Vanliga frågor — PeptivaLab Group" },
      { property: "og:description", content: "Svar på de vanligaste frågorna om PeptivaLab Groups peptidhudvård." },
    ],
  }),
  component: FaqPage,
});

const faqs = [
  { q: "Vad är peptider och vad gör de för huden?", a: "Peptider är korta kedjor av aminosyror som signalerar till huden att producera mer kollagen och elastin. Resultatet blir fastare, slätare och mer återhämtad hud över tid." },
  { q: "Hur lång tid tar leveransen?", a: "Vi skickar samma dag om du beställer före kl 14. Leverans tar normalt 1–3 arbetsdagar inom Sverige." },
  { q: "När ser jag resultat?", a: "De flesta märker en mjukare och mer återfuktad hud inom 1–2 veckor. Synlig förbättring av fina linjer och spänst syns vanligtvis efter 4–8 veckors daglig användning." },
  { q: "Kan jag använda peptider med retinol eller vitamin C?", a: "Ja. Peptider fungerar bra ihop med retinol (kvällstid) och vitamin C (morgon). Applicera peptidserumet först och låt det absorberas i en minut." },
  { q: "Är produkterna säkra för känslig hud och under graviditet?", a: "Ja, alla våra peptidformuleringar är dermatologiskt testade och anses säkra under graviditet och amning. Vid tveksamhet — rådfråga din läkare." },
  { q: "Kan jag returnera produkten?", a: "Vi erbjuder 30 dagars nöjdkundgaranti — även på öppnade produkter. Är du inte nöjd får du pengarna tillbaka." },
  { q: "Vilka betalningssätt accepterar ni?", a: "Vi tar emot Klarna (faktura och delbetalning), Swish, samt kort via Visa, Mastercard och Amex." },
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
