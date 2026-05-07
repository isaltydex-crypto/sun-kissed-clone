import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSiteContent } from "@/context/SiteContentContext";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Vanliga frågor — PeptivaLab Group" },
      { name: "description", content: "Svar på de vanligaste frågorna om PeptivaLab Groups peptidhudvård." },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  const c = useSiteContent().faq;
  return (
    <>
      <section className="bg-ocean py-16 text-primary-foreground md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <h1 className="text-4xl font-bold md:text-5xl">{c.heroTitle}</h1>
          <p className="mt-3 text-primary-foreground/80">{c.heroSubtitle}</p>
        </div>
      </section>
      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <Accordion type="single" collapsible className="w-full">
            {c.items.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base font-semibold text-ocean">{f.q}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-wrap text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  );
}
