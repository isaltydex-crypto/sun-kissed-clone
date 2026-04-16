import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/om-oss")({
  head: () => ({
    meta: [
      { title: "Om oss — Soldis" },
      { name: "description", content: "Soldis grundades 2018 i Stockholm med en enkel idé: en vacker solbränna utan att skada huden." },
      { property: "og:title", content: "Om oss — Soldis" },
      { property: "og:description", content: "Lär känna Soldis — Sveriges favorit för självbruna produkter." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <section className="bg-ocean py-16 text-primary-foreground md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <h1 className="text-4xl font-bold md:text-5xl">Om Soldis</h1>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Vi tror på att alla förtjänar att kunna känna sig sommarfräscha — året runt, utan kompromisser för hudens hälsa.
          </p>
        </div>
      </section>
      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto grid max-w-5xl gap-12 px-4 md:grid-cols-2 md:px-8">
          <div>
            <h2 className="text-2xl font-bold text-ocean">Vår historia</h2>
            <p className="mt-4 text-muted-foreground">
              Soldis grundades 2018 i Stockholm av två väninnor som var trötta på orangea, randiga självbruna produkter. Efter två år av utveckling tillsammans med dermatologer lanserade vi vår första mousse — och resten är historia.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-ocean">Vår filosofi</h2>
            <p className="mt-4 text-muted-foreground">
              Naturligt resultat, snälla ingredienser och förpackningar du vill ställa fram. Alla våra produkter är veganska, cruelty-free och formulerade utan parabener eller mineraloljor.
            </p>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-5xl px-4 md:px-8">
          <div className="grid gap-6 rounded-2xl bg-sand p-8 sm:grid-cols-3">
            {[
              { n: "150k+", l: "Nöjda kunder" },
              { n: "4.9★", l: "Snittbetyg" },
              { n: "100%", l: "Vegan & CF" },
            ].map((s) => (
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
