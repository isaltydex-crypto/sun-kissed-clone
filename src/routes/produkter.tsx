import { createFileRoute } from "@tanstack/react-router";
import { products } from "@/data/products";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/produkter")({
  head: () => ({
    meta: [
      { title: "Produkter — PeptivaLab Group" },
      { name: "description", content: "Utforska PeptivaLab Groups sortiment av peptidserum, boosters, ögonkrämer och nattkrämer." },
      { property: "og:title", content: "Produkter — PeptivaLab Group" },
      { property: "og:description", content: "Peptidserum, boosters och krämer för synliga resultat." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  return (
    <>
      <section className="bg-ocean py-16 text-primary-foreground md:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <h1 className="text-4xl font-bold md:text-5xl">Alla produkter</h1>
          <p className="mt-3 max-w-xl text-primary-foreground/80">
            Vetenskapligt formulerad peptidhudvård för fastare, slätare och friskare hud.
          </p>
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
