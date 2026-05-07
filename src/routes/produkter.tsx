import { createFileRoute } from "@tanstack/react-router";
import { useProducts } from "@/context/ProductsContext";
import { ProductCard } from "@/components/ProductCard";
import { useSiteContent } from "@/context/SiteContentContext";

export const Route = createFileRoute("/produkter")({
  head: () => ({
    meta: [
      { title: "Produkter — PeptivaLab Group" },
      { name: "description", content: "Utforska PeptivaLab Groups sortiment." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { products } = useProducts();
  const c = useSiteContent().products;
  return (
    <>
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
