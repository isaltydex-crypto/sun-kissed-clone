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
  description?: string;
};

export const products: Product[] = [
  {
    slug: "bpc-157-5mg",
    name: "BPC-157 — 5 mg",
    tagline: "Body Protection Compound. Lyofiliserad, ≥99% HPLC-renhet.",
    price: 549,
    oldPrice: 649,
    image: mousse,
    badge: "Bästsäljare",
    description:
      "BPC-157 (Body Protection Compound) är ett 15-aminosyrors peptidfragment isolerat från mänskligt magsaftprotein. Studeras i prekliniska modeller för vävnadsregenerering och GI-funktion.\n\nSpecifikation:\n• Sekvens: GEPPPGKPADDAGLV\n• Molekylvikt: 1419,53 g/mol\n• Renhet: ≥99% (HPLC)\n• Form: Lyofiliserat pulver, 5 mg/vial\n• Förvaring: -20°C, skyddat från ljus\n\nEndast för in vitro- och prekliniskt forskningsbruk. Ej avsedd för humant eller veterinärt bruk. CoA medföljer varje order.",
  },
  {
    slug: "tb-500-5mg",
    name: "TB-500 (Thymosin Beta-4) — 5 mg",
    tagline: "Aktivt fragment av Thymosin Beta-4. ≥99% HPLC-renhet.",
    price: 699,
    image: drops,
    description:
      "TB-500 är ett syntetiskt fragment motsvarande den aktiva regionen av Thymosin Beta-4 (Tβ4). Används i prekliniska studier av cellmigration, angiogenes och vävnadsreparation.\n\nSpecifikation:\n• Sekvens: Ac-LKKTETQ\n• Molekylvikt: 889,02 g/mol\n• Renhet: ≥99% (HPLC)\n• Form: Lyofiliserat pulver, 5 mg/vial\n• Förvaring: -20°C\n\nEndast för in vitro- och prekliniskt forskningsbruk. CoA medföljer varje order.",
  },
  {
    slug: "ghk-cu-50mg",
    name: "GHK-Cu (Copper Peptide) — 50 mg",
    tagline: "Tripeptid-koppar(II)-komplex. ≥99% HPLC-renhet.",
    price: 449,
    oldPrice: 499,
    image: mist,
    badge: "Rea",
    description:
      "GHK-Cu är ett naturligt förekommande koppar-bindande tripeptidkomplex (Glycyl-L-histidyl-L-lysin). Studeras i prekliniska modeller av sårläkning, antioxidativa effekter och fibroblastaktivitet.\n\nSpecifikation:\n• Sekvens: Gly-His-Lys + Cu(II)\n• Molekylvikt: 340,84 g/mol\n• Renhet: ≥99% (HPLC)\n• Form: Lyofiliserat pulver, 50 mg/vial\n• Förvaring: -20°C, skyddat från fukt\n\nEndast för in vitro- och prekliniskt forskningsbruk. CoA medföljer varje order.",
  },
  {
    slug: "ipamorelin-5mg",
    name: "Ipamorelin — 5 mg",
    tagline: "Selektiv ghrelin-receptoragonist. ≥99% HPLC-renhet.",
    price: 689,
    image: lotion,
    description:
      "Ipamorelin är en pentapeptid och selektiv agonist till ghrelin-/GHS-R1a-receptorn. Används i prekliniska studier av endokrin signalering och GH-frisättning.\n\nSpecifikation:\n• Sekvens: Aib-His-D-2-Nal-D-Phe-Lys-NH2\n• Molekylvikt: 711,86 g/mol\n• Renhet: ≥99% (HPLC)\n• Form: Lyofiliserat pulver, 5 mg/vial\n• Förvaring: -20°C\n\nEndast för in vitro- och prekliniskt forskningsbruk. CoA medföljer varje order.",
  },
];
