import { createFileRoute } from "@tanstack/react-router";
import { useSiteContent } from "@/context/SiteContentContext";
import { pageHead, breadcrumbLd } from "@/lib/seo";

export const Route = createFileRoute("/om-oss")({
  head: () =>
    pageHead({
      path: "/om-oss",
      title: "Om PeptivaLab Group — svensk leverantör av forskningspeptider",
      description:
        "PeptivaLab Group levererar högrena forskningspeptider till universitet och biotech i Norden. Läs om vår QC-process, syntespartners och kvalitetspolicy.",
      jsonLd: breadcrumbLd([
        { name: "Hem", path: "/" },
        { name: "Om oss", path: "/om-oss" },
      ]),
    }),
  component: AboutPage,
});

function AboutPage() {
  const c = useSiteContent().about;
  return (
    <>
      <section className="bg-ocean py-16 text-primary-foreground md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <h1 className="text-4xl font-bold md:text-5xl">{c.heroTitle}</h1>
          <p className="mt-4 text-lg text-primary-foreground/80">{c.heroSubtitle}</p>
        </div>
      </section>
      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <h2 className="text-2xl font-bold text-ocean">{c.philosophyTitle}</h2>
          <p className="mt-4 whitespace-pre-wrap text-muted-foreground">{c.philosophyBody}</p>
        </div>
      </section>
    </>
  );
}
