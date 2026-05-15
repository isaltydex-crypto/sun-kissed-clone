import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useProducts } from "@/context/ProductsContext";
import { useCart } from "@/context/CartContext";
import { pageHead, breadcrumbLd, absUrl } from "@/lib/seo";

export const Route = createFileRoute("/produkter/$slug")({
  head: ({ params }) => {
    const slug = (params as { slug?: string } | undefined)?.slug ?? "";
    return pageHead({
      path: `/produkter/${slug}`,
      title: `Produkt — PeptivaLab Group`,
      description: "Detaljer, ingredienser och användning för vår peptidhudvård.",
      type: "article",
      jsonLd: breadcrumbLd([
        { name: "Hem", path: "/" },
        { name: "Produkter", path: "/produkter" },
        { name: slug, path: `/produkter/${slug}` },
      ]),
    });
  },
  component: ProductDetailPage,
  notFoundComponent: () => (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ocean-deep">Produkten finns inte</h1>
        <Link to="/produkter" className="mt-6 inline-block rounded-full bg-ocean-deep px-6 py-2 text-sm font-semibold uppercase tracking-wider text-primary-foreground">
          Till alla produkter
        </Link>
      </div>
    </div>
  ),
});

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const { products, hydrated } = useProducts();
  const { addItem } = useCart();
  const product = products.find((p) => p.slug === slug);

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Laddar produkt…
      </div>
    );
  }
  if (!product) throw notFound();

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.tagline,
    image: product.image ? [absUrl(product.image)] : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "SEK",
      price: product.price,
      availability: "https://schema.org/InStock",
      url: absUrl(`/produkter/${product.slug}`),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <section className="bg-background py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <nav className="mb-6 text-sm text-muted-foreground">
            <Link to="/produkter" className="hover:text-ocean">← Alla produkter</Link>
          </nav>
          <div className="grid gap-8 md:grid-cols-2 md:gap-12">
            <div className="relative overflow-hidden rounded-2xl bg-sand">
              {product.badge && (
                <span className="absolute left-4 top-4 z-10 rounded-full bg-sun px-3 py-1 text-xs font-bold uppercase tracking-wider text-ocean-deep">
                  {product.badge}
                </span>
              )}
              <img
                src={product.image}
                alt={product.name}
                className="aspect-square w-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold text-ocean-deep md:text-4xl">{product.name}</h1>
              {product.tagline && (
                <p className="mt-2 text-lg text-muted-foreground">{product.tagline}</p>
              )}
              <div className="mt-6 flex items-baseline gap-3">
                {product.oldPrice && (
                  <span className="text-lg text-muted-foreground line-through">{product.oldPrice} kr</span>
                )}
                <span className="text-3xl font-bold text-ocean">{product.price} kr</span>
              </div>
              <button
                onClick={() => addItem(product)}
                className="mt-6 w-full rounded-lg bg-ocean py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean-deep md:w-auto md:px-10"
              >
                Lägg i varukorg
              </button>
              {product.description && (
                <div className="mt-10 whitespace-pre-wrap text-base leading-relaxed text-foreground">
                  {product.description}
                </div>
              )}
              {!product.description && (
                <p className="mt-10 text-sm italic text-muted-foreground">
                  Mer produktinformation kommer snart.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
