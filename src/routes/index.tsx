import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Truck, Shield, Leaf } from "lucide-react";
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
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-8 md:py-24">
          <div className="text-primary-foreground">
            <span className="inline-block rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              Vetenskap möter hudvård
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
              Peptider.<br />Synliga resultat.
            </h1>
            <p className="mt-5 max-w-md text-lg text-primary-foreground/90">
              Kliniskt formulerade peptidserum och krämer som stärker, slätar och återuppbygger huden — dag för dag. Snabb leverans och 30 dagars nöjdkundgaranti.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/produkter" className="rounded-lg bg-sun px-6 py-3 text-sm font-bold uppercase tracking-wider text-ocean-deep transition hover:bg-sun-deep">
                Handla nu
              </Link>
              <Link to="/om-oss" className="rounded-lg border-2 border-white/40 px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:bg-white/10">
                Läs mer
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-sun text-sun" />
                ))}
              </div>
              <span className="text-sm text-primary-foreground/90">4.9 av 5 — 1 820 recensioner</span>
            </div>
          </div>
          <div className="relative">
            <img
              src={hero}
              alt="PeptivaLab Group peptidserum och krämer"
              width={1600}
              height={1024}
              className="rounded-3xl shadow-[var(--shadow-warm)]"
            />
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:grid-cols-3 md:px-8">
          <div className="flex items-center gap-3">
            <Truck className="h-6 w-6 text-ocean" />
            <div><p className="text-sm font-semibold">Snabb leverans</p><p className="text-xs text-muted-foreground">1–3 arbetsdagar</p></div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-ocean" />
            <div><p className="text-sm font-semibold">Dermatologiskt testad</p><p className="text-xs text-muted-foreground">Säkert för alla hudtyper</p></div>
          </div>
          <div className="flex items-center gap-3">
            <Leaf className="h-6 w-6 text-ocean" />
            <div><p className="text-sm font-semibold">Vegan & cruelty-free</p><p className="text-xs text-muted-foreground">Rena formuleringar</p></div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mb-12 text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-sun-deep">Våra produkter</span>
            <h2 className="mt-2 text-3xl font-bold text-ocean md:text-4xl">Hitta din peptidrutin</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-sand py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-ocean md:text-4xl">Så fungerar det</h2>
            <p className="mt-3 text-muted-foreground">Tre steg till en starkare, friskare hud.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { n: "01", t: "Rengör", d: "Börja med ren och lätt fuktig hud för optimal absorption." },
              { n: "02", t: "Applicera", d: "Massera in serum eller booster i ansikte och hals." },
              { n: "03", t: "Lås in", d: "Avsluta med en peptidkräm för fukt och långvarig effekt." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl bg-card p-8 shadow-[var(--shadow-card)]">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-sun font-bold text-ocean-deep">{s.n}</div>
                <h3 className="text-xl font-semibold text-ocean">{s.t}</h3>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ocean py-16 text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <h2 className="text-3xl font-bold md:text-4xl">Redo att börja din peptidresa?</h2>
          <p className="mt-3 text-primary-foreground/80">Få 10% rabatt på din första order när du anmäler dig till nyhetsbrevet.</p>
          <Link to="/produkter" className="mt-7 inline-block rounded-lg bg-sun px-8 py-3 text-sm font-bold uppercase tracking-wider text-ocean-deep transition hover:bg-sun-deep">
            Utforska sortimentet
          </Link>
        </div>
      </section>
    </>
  );
}
