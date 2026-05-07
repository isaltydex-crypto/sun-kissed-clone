import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Truck, Shield, Leaf, FlaskConical } from "lucide-react";
import logo from "@/assets/logo.png";
import hero from "@/assets/hero-products.jpg";
import { useProducts } from "@/context/ProductsContext";
import { useSiteContent } from "@/context/SiteContentContext";
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
  const { products } = useProducts();
  const c = useSiteContent();
  return (
    <>
      {/* Centered hero */}
      <section className="bg-background">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-2 pb-10 text-center md:pt-10 md:pb-20">
          <div className="flex flex-col items-center">
            <img
              src={logo}
              alt="PeptivaLab Group"
              className="h-[7.5rem] w-[7.5rem] object-contain sm:h-40 sm:w-40 md:h-56 md:w-56"
            />
            <h2
              className="-mt-1 text-2xl italic tracking-tight text-ocean-deep sm:text-3xl md:text-4xl"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}
            >
              peptiva<span className="font-normal">Lab</span>
              <span className="ml-2 align-middle text-[10px] not-italic uppercase tracking-[0.35em] text-sun-deep sm:text-xs sm:tracking-[0.4em]">Group</span>
            </h2>
          </div>
          <span className="mt-6 text-[10px] font-semibold uppercase tracking-[0.3em] text-sun-deep sm:text-xs">
            {c.home.eyebrow}
          </span>
          <h1 className="mt-4 text-[2rem] font-bold leading-[1.1] text-ocean-deep sm:text-4xl md:text-6xl">
            {c.home.title}
          </h1>
          <p className="mt-5 max-w-xl text-[15px] text-muted-foreground sm:text-base md:text-lg">
            {c.home.subtitle}
          </p>
          <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
            <Link to="/produkter" className="rounded-full bg-ocean-deep px-7 py-3 text-center text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean">
              {c.home.primaryCta}
            </Link>
            <Link to="/om-oss" className="rounded-full border border-ocean-deep/20 px-7 py-3 text-center text-sm font-semibold uppercase tracking-wider text-ocean-deep transition hover:bg-sand">
              {c.home.secondaryCta}
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-sun-deep text-sun-deep" />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">{c.home.rating}</span>
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
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sun-deep">{c.home.productsEyebrow}</span>
          <h2 className="mt-3 text-3xl font-bold text-ocean-deep md:text-4xl">{c.home.productsTitle}</h2>
          <p className="mt-4 text-muted-foreground">{c.home.productsSubtitle}</p>
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
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sun-deep">{c.home.ritualEyebrow}</span>
          <h2 className="mt-3 text-3xl font-bold text-ocean-deep md:text-4xl">{c.home.ritualTitle}</h2>
        </div>
        <div className="mx-auto mt-14 max-w-3xl space-y-10 px-4 md:px-8">
          {c.home.ritualSteps.map((s) => (
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
          <h2 className="text-3xl font-bold text-ocean-deep md:text-4xl">{c.home.ctaTitle}</h2>
          <p className="mt-4 text-muted-foreground">{c.home.ctaSubtitle}</p>
          <Link to="/produkter" className="mt-8 inline-block rounded-full bg-ocean-deep px-8 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean">
            {c.home.ctaButton}
          </Link>
        </div>
      </section>
    </>
  );
}
