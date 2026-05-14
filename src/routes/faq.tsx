import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSiteContent } from "@/context/SiteContentContext";
import { pageHead, breadcrumbLd } from "@/lib/seo";

export const Route = createFileRoute("/faq")({
  head: () =>
    pageHead({
      path: "/faq",
      title: "Vanliga frågor om peptidhudvård | PeptivaLab Group",
      description:
        "Svar om peptider, hur du använder serum och krämer, leverans, retur och ångerrätt — kundtjänst hos PeptivaLab Group.",
      jsonLd: breadcrumbLd([
        { name: "Hem", path: "/" },
        { name: "Vanliga frågor", path: "/faq" },
      ]),
    }),
  component: FaqPage,
});

function FaqPage() {
  const c = useSiteContent().faq;

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
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
