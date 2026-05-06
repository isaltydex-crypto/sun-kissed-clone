import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { products as seedProducts, type Product } from "@/data/products";

type ProductsContextValue = {
  products: Product[];
  hydrated: boolean;
  addProduct: (p: Product) => void;
  updateProduct: (slug: string, patch: Partial<Product>) => void;
  removeProduct: (slug: string) => void;
  resetToDefaults: () => void;
};

const ProductsContext = createContext<ProductsContextValue | null>(null);
const STORAGE_KEY = "peptivalab.products.v1";

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Product[];
        if (Array.isArray(parsed) && parsed.length > 0) setProducts(parsed);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch {
      // ignore
    }
  }, [products, hydrated]);

  const value = useMemo<ProductsContextValue>(
    () => ({
      products,
      hydrated,
      addProduct: (p) =>
        setProducts((prev) =>
          prev.some((x) => x.slug === p.slug) ? prev : [...prev, p],
        ),
      updateProduct: (slug, patch) =>
        setProducts((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p))),
      removeProduct: (slug) => setProducts((prev) => prev.filter((p) => p.slug !== slug)),
      resetToDefaults: () => setProducts(seedProducts),
    }),
    [products, hydrated],
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within ProductsProvider");
  return ctx;
}
