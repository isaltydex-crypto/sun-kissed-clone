import { createFileRoute } from "@tanstack/react-router";
import { useSiteContent } from "@/context/SiteContentContext";

export const Route = createFileRoute("/integritetspolicy")({
  head: () => ({
    meta: [
      { title: "Integritetspolicy — peptivaLab Group" },
      {
        name: "description",
        content:
          "Så hanterar peptivaLab Group dina personuppgifter när du handlar i vår webbutik.",
      },
      { property: "og:title", content: "Integritetspolicy — peptivaLab Group" },
      {
        property: "og:description",
        content:
          "Information om hur vi samlar in, lagrar och skyddar dina personuppgifter enligt GDPR.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const c = useSiteContent();
  const updated = "11 maj 2026";
  return (
    <section className="bg-background py-12 md:py-20">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-ocean-deep md:text-4xl">
            Integritetspolicy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Senast uppdaterad: {updated}
          </p>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-foreground md:text-base">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              1. Personuppgiftsansvarig
            </h2>
            <p>
              {c.brand.name} är personuppgiftsansvarig för behandlingen av dina
              personuppgifter. Du når oss på{" "}
              <a className="text-ocean underline" href={`mailto:${c.contact.email}`}>
                {c.contact.email}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              2. Vilka uppgifter vi samlar in
            </h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Namn, e-postadress, telefonnummer och leveransadress.</li>
              <li>Orderuppgifter, beställda produkter och betalningsstatus.</li>
              <li>
                Teknisk information såsom IP-adress och webbläsare för
                bedrägerikontroll och loggning.
              </li>
            </ul>
            <p className="mt-2">
              Vi behandlar inga kortuppgifter — betalningar hanteras direkt av
              vår betalleverantör.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              3. Ändamål och rättslig grund
            </h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                Fullgöra köpeavtalet med dig (artikel 6.1.b GDPR) — leverera
                ordern, hantera retur och support.
              </li>
              <li>
                Uppfylla rättsliga skyldigheter (artikel 6.1.c GDPR) — t.ex.
                bokföringslagen.
              </li>
              <li>
                Berättigat intresse (artikel 6.1.f GDPR) — säkerhet,
                bedrägeriprevention och förbättring av tjänsten.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              4. Lagringstid
            </h2>
            <p>
              Orderuppgifter sparas i sju år enligt bokföringslagen.
              Marknadsföringsuppgifter sparas tills du avregistrerar dig.
              Tekniska loggar raderas normalt inom 90 dagar.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              5. Mottagare
            </h2>
            <p>
              Vi delar uppgifter med betrodda underbiträden i syfte att leverera
              tjänsten: betalleverantör, fraktbolag, e-post- och
              molninfrastruktur. Inga uppgifter säljs vidare.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              6. Dina rättigheter
            </h2>
            <p>
              Du har rätt till tillgång, rättelse, radering, begränsning,
              dataportabilitet och att invända mot behandling. Kontakta oss på{" "}
              <a className="text-ocean underline" href={`mailto:${c.contact.email}`}>
                {c.contact.email}
              </a>{" "}
              för att utöva dina rättigheter. Du har även rätt att lämna
              klagomål till Integritetsskyddsmyndigheten (IMY).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              7. Cookies
            </h2>
            <p>
              Vi använder endast nödvändiga cookies för att kassan, inloggning
              och varukorg ska fungera. Inga spårnings- eller marknadsförings-
              cookies används utan ditt samtycke.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              8. Ändringar
            </h2>
            <p>
              Vi kan komma att uppdatera policyn. Den senaste versionen
              publiceras alltid på denna sida.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
