import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product } from "@/data/products";
import {
  listProducts,
  createProduct,
  updateProductFn,
  deleteProductFn,
} from "@/lib/products.functions";

type ProductsContextValue = {
  products: Product[];
  hydrated: boolean;
  refresh: () => Promise<void>;
  addProduct: (p: Product) => Promise<void>;
  updateProduct: (originalSlug: string, patch: Product) => Promise<void>;
  removeProduct: (slug: string) => Promise<void>;
};

const ProductsContext = createContext<ProductsContextValue | null>(null);

function toInput(p: Product) {
  return {
    slug: p.slug,
    name: p.name,
    tagline: p.tagline ?? "",
    price: Math.round(p.price),
    oldPrice: p.oldPrice != null ? Math.round(p.oldPrice) : null,
    image: p.image ?? "",
    badge: p.badge ?? null,
  };
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await listProducts();
      setProducts(res.products);
    } catch (err) {
      console.error("listProducts failed", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ProductsContextValue>(
    () => ({
      products,
      hydrated,
      refresh,
      addProduct: async (p) => {
        const res = await createProduct({ data: toInput(p) });
        setProducts((current) => [...current.filter((item) => item.slug !== res.product.slug), res.product]);
        void refresh();
      },
      updateProduct: async (originalSlug, patch) => {
        const res = await updateProductFn({ data: { ...toInput(patch), originalSlug } });
        setProducts((current) => current.map((item) => (item.slug === originalSlug ? res.product : item)));
        void refresh();
      },
      removeProduct: async (slug) => {
        await deleteProductFn({ data: { slug } });
        setProducts((current) => current.filter((item) => item.slug !== slug));
        void refresh();
      },
    }),
    [products, hydrated, refresh],
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within ProductsProvider");
  return ctx;
}
