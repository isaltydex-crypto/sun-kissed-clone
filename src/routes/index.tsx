import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Truck, Shield, Leaf, FlaskConical } from "lucide-react";
import logo from "@/assets/logo.jpeg";
import hero from "@/assets/hero-products.jpg";
import { products } from "@/data/products";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PeptivaLab Group — Premium peptidhudvård för synliga resultat" },
      { name: "description", content: "Vetenskapligt formulerade peptidserum, boosters och krämer för fastare, slätare hud. Fri frakt över 499 kr." },
      { property: "og:title", content: "PeptivaLab Group — Premium peptidhudvård" },
      { property: "og:description", content: "Vetenskapligt formulerade peptidprodukter för fastare, slätare hud." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      {/* Centered hero */}
      <section className="bg-background">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-20 pb-14 text-center md:pt-28 md:pb-20">
          <img
            src={logo}
            alt="PeptivaLab Group"
            className="h-28 w-28 rounded-xl bg-white object-contain p-2 shadow-[var(--shadow-card)] md:h-36 md:w-36"
          />
          <span className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-sun-deep">
            Klinisk peptidhudvård
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] text-ocean-deep md:text-6xl">
            Vetenskap för<br />en synligt friskare hud.
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            Rena, kliniskt doserade peptidformuleringar utvecklade i Sverige — för fastare,
            slätare och mer återhämtad hud, dag för dag.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/produkter" className="rounded-full bg-ocean-deep px-7 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean">
              Handla sortimentet
            </Link>
            <Link to="/om-oss" className="rounded-full border border-ocean-deep/20 px-7 py-3 text-sm font-semibold uppercase tracking-wider text-ocean-deep transition hover:bg-sand">
              Vår vetenskap
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-sun-deep text-sun-deep" />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">4.9 / 5 — 1 820 verifierade recensioner</span>
          </div>
        </div>
      </section>

      {/* Quiet hero image */}
      <section className="bg-background pb-16 md:pb-24">
        <div className="mx-auto max-w-5xl px-4">
          <img
            src={hero}
            alt="PeptivaLab Group peptidserum och krämer"
            width={1600}
            height={1024}
            className="w-full rounded-2xl object-cover shadow-[var(--shadow-warm)]"
          />
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border bg-sand">
        <div className="mx-auto grid max-w-4xl gap-8 px-4 py-10 text-center sm:grid-cols-4 md:px-8">
          {[
            { Icon: FlaskConical, t: "Kliniska doser" },
            { Icon: Truck, t: "Snabb leverans" },
            { Icon: Shield, t: "Dermatologiskt testad" },
            { Icon: Leaf, t: "Vegan & cruelty-free" },
          ].map(({ Icon, t }) => (
            <div key={t} className="flex flex-col items-center gap-2">
              <Icon className="h-5 w-5 text-ocean-deep" />
              <p className="text-xs font-semibold uppercase tracking-wider text-ocean-deep">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="bg-background py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sun-deep">Sortimentet</span>
          <h2 className="mt-3 text-3xl font-bold text-ocean-deep md:text-4xl">En komplett peptidrutin</h2>
          <p className="mt-4 text-muted-foreground">
            Fyra produkter — formulerade för att fungera tillsammans eller var för sig.
          </p>
        </div>
        <div className="mx-auto mt-14 max-w-6xl px-4 md:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </div>
      </section>

      {/* Ritual */}
      <section className="bg-sand py-20 md:py-28">
        <div className="mx-auto max-w-2xl px-4 text-center md:px-8">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sun-deep">Ritualen</span>
          <h2 className="mt-3 text-3xl font-bold text-ocean-deep md:text-4xl">Tre lugna steg</h2>
        </div>
        <div className="mx-auto mt-14 max-w-3xl space-y-10 px-4 md:px-8">
          {[
            { n: "01", t: "Rengör", d: "Börja med ren och lätt fuktig hud för optimal absorption." },
            { n: "02", t: "Applicera", d: "Massera in serum eller booster i ansikte och hals." },
            { n: "03", t: "Lås in", d: "Avsluta med en peptidkräm för fukt och långvarig effekt." },
          ].map((s) => (
            <div key={s.n} className="flex gap-6 border-b border-border pb-8 last:border-b-0">
              <div className="text-3xl font-light text-sun-deep">{s.n}</div>
              <div>
                <h3 className="text-xl font-semibold text-ocean-deep">{s.t}</h3>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-background py-24">
        <div className="mx-auto max-w-2xl px-4 text-center md:px-8">
          <h2 className="text-3xl font-bold text-ocean-deep md:text-4xl">Börja din peptidresa.</h2>
          <p className="mt-4 text-muted-foreground">
            Få 10% rabatt på din första order när du anmäler dig till nyhetsbrevet.
          </p>
          <Link to="/produkter" className="mt-8 inline-block rounded-full bg-ocean-deep px-8 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean">
            Utforska sortimentet
          </Link>
        </div>
      </section>
    </>
  );
}
