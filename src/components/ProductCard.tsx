import { Link } from "@tanstack/react-router";
import type { Product } from "@/data/products";
import { useCart } from "@/context/CartContext";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-warm)]">
      <Link
        to="/produkter/$slug"
        params={{ slug: product.slug }}
        className="relative block aspect-square overflow-hidden bg-sand"
      >
        {product.badge && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-sun px-3 py-1 text-xs font-bold uppercase tracking-wider text-ocean-deep">
            {product.badge}
          </span>
        )}
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          width={800}
          height={800}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link
          to="/produkter/$slug"
          params={{ slug: product.slug }}
          className="text-base font-semibold text-foreground hover:text-ocean"
        >
          {product.name}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p>
        <div className="mt-4 flex items-baseline gap-2">
          {product.oldPrice && (
            <span className="text-sm text-muted-foreground line-through">{product.oldPrice} kr</span>
          )}
          <span className="text-xl font-bold text-ocean">{product.price} kr</span>
        </div>
        <div className="mt-4 flex gap-2">
          <Link
            to="/produkter/$slug"
            params={{ slug: product.slug }}
            className="flex-1 rounded-lg border border-ocean py-2.5 text-center text-sm font-semibold uppercase tracking-wider text-ocean transition hover:bg-ocean/10"
          >
            Läs mer
          </Link>
          <button
            onClick={() => addItem(product)}
            className="flex-1 rounded-lg bg-ocean py-2.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean-deep"
          >
            Köp
          </button>
        </div>
      </div>
    </div>
  );
}
