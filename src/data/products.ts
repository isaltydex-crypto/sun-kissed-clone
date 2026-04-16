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
    slug: "self-tan-mousse",
    name: "Self-Tan Mousse — Medium",
    tagline: "Snabbtorkande, jämn färg på 4 timmar",
    price: 349,
    oldPrice: 399,
    image: mousse,
    badge: "Bästsäljare",
  },
  {
    slug: "tanning-drops",
    name: "Tanning Drops 30ml",
    tagline: "Blanda i din dagkräm för en gradvis glow",
    price: 299,
    image: drops,
  },
  {
    slug: "tanning-mist",
    name: "Self-Tan Mist 200ml",
    tagline: "Lätt spray för rygg och svåråtkomliga ställen",
    price: 329,
    oldPrice: 379,
    image: mist,
    badge: "Rea",
  },
  {
    slug: "gradual-lotion",
    name: "Gradual Tan Body Lotion",
    tagline: "Fukt och färg i ett — bygg upp gradvis",
    price: 269,
    image: lotion,
  },
];
