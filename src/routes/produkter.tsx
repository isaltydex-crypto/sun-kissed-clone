import { createFileRoute } from "@tanstack/react-router";
import { useProducts } from "@/context/ProductsContext";
import { ProductCard } from "@/components/ProductCard";
import { useSiteContent } from "@/context/SiteContentContext";
import { pageHead, absUrl, breadcrumbLd } from "@/lib/seo";

export const Route = createFileRoute("/produkter")({
  head: () =>
    pageHead({
      path: "/produkter",
      title: "Produkter — Peptidserum, boosters & krämer | PeptivaLab Group",
      description:
        "Hela sortimentet av PeptivaLab Groups peptidhudvård. Kliniska doser, vegan, dermatologiskt testad. Fri frakt över 499 kr.",
      jsonLd: breadcrumbLd([
        { name: "Hem", path: "/" },
        { name: "Produkter", path: "/produkter" },
      ]),
    }),
  component: ProductsPage,
});

function ProductsPage() {
  const { products } = useProducts();
  const c = useSiteContent().products;

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "PeptivaLab Group — Produkter",
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absUrl(`/produkter#${p.slug}`),
      name: p.name,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <section className="bg-ocean py-16 text-primary-foreground md:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <h1 className="text-4xl font-bold md:text-5xl">{c.heroTitle}</h1>
          <p className="mt-3 max-w-xl text-primary-foreground/80">{c.heroSubtitle}</p>
        </div>
      </section>
      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </div>
      </section>
    </>
  );
}
