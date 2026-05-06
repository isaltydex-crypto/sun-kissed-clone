import mousse from "@/assets/product-mousse.jpg";
import drops from "@/assets/product-drops.jpg";
import mist from "@/assets/product-mist.jpg";
import lotion from "@/assets/product-lotion.jpg";

export type Product = {
  slug: string;
  name: string;
  tagline: string;
  price: number;
  oldPrice?: number;
  image: string;
  badge?: string;
};

export const products: Product[] = [
  {
    slug: "matrixyl-serum",
    name: "Matrixyl 10% Peptidserum",
    tagline: "Slätar ut fina linjer och stärker hudens spänst",
    price: 549,
    oldPrice: 649,
    image: mousse,
    badge: "Bästsäljare",
  },
  {
    slug: "copper-peptide-booster",
    name: "Copper Peptide Booster",
    tagline: "GHK-Cu för fastare, mer återhämtad hud",
    price: 599,
    image: drops,
  },
  {
    slug: "peptide-eye-cream",
    name: "Peptide Eye Cream 15ml",
    tagline: "Reducerar mörka ringar och svullnad",
    price: 449,
    oldPrice: 499,
    image: mist,
    badge: "Rea",
  },
  {
    slug: "peptide-night-cream",
    name: "Peptide Night Cream",
    tagline: "Återuppbyggande nattkräm med 5 peptider",
    price: 689,
    image: lotion,
  },
];
