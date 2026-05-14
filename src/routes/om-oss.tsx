import { createFileRoute } from "@tanstack/react-router";
import { useSiteContent } from "@/context/SiteContentContext";
import { pageHead, breadcrumbLd } from "@/lib/seo";

export const Route = createFileRoute("/om-oss")({
  head: () =>
    pageHead({
      path: "/om-oss",
      title: "Om PeptivaLab Group — svensk peptidhudvård utvecklad med dermatologer",
      description:
        "PeptivaLab Group utvecklar klinisk peptidhudvård i Sverige tillsammans med dermatologer. Läs om vår historia, filosofi och vetenskap.",
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
        <div className="mx-auto grid max-w-5xl gap-12 px-4 md:grid-cols-2 md:px-8">
          <div>
            <h2 className="text-2xl font-bold text-ocean">{c.historyTitle}</h2>
            <p className="mt-4 whitespace-pre-wrap text-muted-foreground">{c.historyBody}</p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-ocean">{c.philosophyTitle}</h2>
            <p className="mt-4 whitespace-pre-wrap text-muted-foreground">{c.philosophyBody}</p>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-5xl px-4 md:px-8">
          <div className="grid gap-6 rounded-2xl bg-sand p-8 sm:grid-cols-3">
            {c.stats.map((s) => (
              <div key={s.l} className="text-center">
                <div className="text-3xl font-bold text-ocean">{s.n}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
