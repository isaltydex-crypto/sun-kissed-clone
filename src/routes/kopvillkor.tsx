import { createFileRoute, Link } from "@tanstack/react-router";
import { useSiteContent } from "@/context/SiteContentContext";

export const Route = createFileRoute("/kopvillkor")({
  head: () => ({
    meta: [
      { title: "Köpvillkor — peptivaLab Group" },
      {
        name: "description",
        content:
          "Allmänna köpvillkor för beställningar i peptivaLab Groups webbutik — leverans, betalning, ångerrätt och retur.",
      },
      { property: "og:title", content: "Köpvillkor — peptivaLab Group" },
      {
        property: "og:description",
        content:
          "Våra allmänna villkor för köp, leverans, betalning och retur.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const c = useSiteContent();
  const updated = "11 maj 2026";
  return (
    <section className="bg-background py-12 md:py-20">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-ocean-deep md:text-4xl">
            Köpvillkor
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Senast uppdaterad: {updated}
          </p>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-foreground md:text-base">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              1. Allmänt
            </h2>
            <p>
              Dessa villkor gäller mellan {c.brand.name} (”vi”, ”oss”) och dig
              som kund (”du”) vid köp via vår webbutik. Genom att slutföra en
              beställning godkänner du villkoren. Du måste vara minst 18 år
              eller ha målsmans samtycke för att handla.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              2. Beställning och avtal
            </h2>
            <p>
              Avtal ingås när vi bekräftat din beställning via e-post. Vi
              förbehåller oss rätten att neka eller annullera en order vid
              prissättnings- eller lagerfel, vid misstänkt bedrägeri eller om
              produkten av annan anledning inte kan levereras.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              3. Priser och betalning
            </h2>
            <p>
              Alla priser anges i SEK inklusive moms. Frakt tillkommer enligt
              den fraktavgift som visas i kassan. Betalning sker med krypto-
              valuta via vår betalleverantör. Beställningen behandlas när
              betalningen bekräftats på blockkedjan.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              4. Leverans
            </h2>
            <p>
              Vi skickar inom 1–2 arbetsdagar efter bekräftad betalning.
              Normal leveranstid inom Sverige är 1–3 arbetsdagar. Vi
              ansvarar för varan tills den är mottagen av dig.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              5. Ångerrätt
            </h2>
            <p>
              Du har 14 dagars ångerrätt enligt lagen om distansavtal, räknat
              från den dag du tar emot varan. För att utnyttja ångerrätten,
              kontakta oss på{" "}
              <a className="text-ocean underline" href={`mailto:${c.contact.email}`}>
                {c.contact.email}
              </a>
              . Varan ska återsändas i väsentligen oförändrat skick. Du står
              för returfrakten. Vi återbetalar köpesumman inom 14 dagar från
              det att vi mottagit returen.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              6. Reklamation
            </h2>
            <p>
              Vid fel på vara, kontakta oss inom skälig tid (normalt inom två
              månader från upptäckt). Konsumentköplagen tillämpas. Vi står för
              returfrakten vid godkänd reklamation.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              7. Personuppgifter
            </h2>
            <p>
              Vi behandlar dina personuppgifter i enlighet med vår{" "}
              <Link to="/integritetspolicy" className="text-ocean underline">
                integritetspolicy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              8. Tvist
            </h2>
            <p>
              Vid tvist följer vi Allmänna reklamationsnämndens (ARN)
              rekommendationer. Du kan även använda EU:s plattform för
              tvistlösning online:{" "}
              <a
                className="text-ocean underline"
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noreferrer"
              >
                ec.europa.eu/consumers/odr
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-ocean-deep">
              9. Kontakt
            </h2>
            <p>
              {c.brand.name}
              <br />
              {c.contact.address.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
              {c.contact.email}
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
