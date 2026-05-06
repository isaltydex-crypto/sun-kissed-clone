import type { Product } from "@/data/products";
import { useCart } from "@/context/CartContext";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-warm)]">
      <div className="relative aspect-square overflow-hidden bg-sand">
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
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold text-foreground">{product.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p>
        <div className="mt-4 flex items-baseline gap-2">
          {product.oldPrice && (
            <span className="text-sm text-muted-foreground line-through">{product.oldPrice} kr</span>
          )}
          <span className="text-xl font-bold text-ocean">{product.price} kr</span>
        </div>
        <button
          onClick={() => addItem(product)}
          className="mt-4 w-full rounded-lg bg-ocean py-2.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean-deep"
        >
          Lägg i varukorg
        </button>
      </div>
    </div>
  );
}
