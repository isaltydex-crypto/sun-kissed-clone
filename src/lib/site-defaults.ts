// Default editable content. Used as fallback when nothing is stored in
// `site_content` yet (or when a single field is left blank).
//
// To make a new piece of text/info editable: add a field here, then read it
// via `useContent(key)` in the component, and add an input for it in
// /admin/innehall.

export type SiteDefaults = {
  brand: {
    name: string;
    tagline: string;
  };
  menu: {
    home: string;
    products: string;
    about: string;
    faq: string;
    contact: string;
  };
  home: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    rating: string;
    productsEyebrow: string;
    productsTitle: string;
    productsSubtitle: string;
    ritualEyebrow: string;
    ritualTitle: string;
    ritualSteps: { n: string; t: string; d: string }[];
    ctaTitle: string;
    ctaSubtitle: string;
    ctaButton: string;
  };
  about: {
    heroTitle: string;
    heroSubtitle: string;
    historyTitle: string;
    historyBody: string;
    philosophyTitle: string;
    philosophyBody: string;
    stats: { n: string; l: string }[];
  };
  contact: {
    heroTitle: string;
    heroSubtitle: string;
    email: string;
    address: string;
    hours: string;
  };
  faq: {
    heroTitle: string;
    heroSubtitle: string;
    items: { q: string; a: string }[];
  };
  products: {
    heroTitle: string;
    heroSubtitle: string;
  };
  footer: {
    blurb: string;
    shopHeading: string;
    helpHeading: string;
    newsletterHeading: string;
    newsletterBlurb: string;
    copyright: string;
  };
  emails: {
    /** Brand line shown at the top of every notification email. */
    brandHeader: string;
    /** Footer line shown at the bottom of every notification email. */
    footer: string;
    /** Contact form notification (sent to staff when someone submits /kontakt). */
    contactSubject: string;
    contactBody: string;
    /** Backup / verify failure alert (sent from the backup container). */
    alertSubject: string;
    alertBody: string;
  };
};

export const siteDefaults: SiteDefaults = {
  brand: {
    name: "peptivaLab Group",
    tagline: "Premium peptidhudvård utvecklad i Sverige.",
  },
  menu: {
    home: "Hem",
    products: "Produkter",
    about: "Om oss",
    faq: "FAQ",
    contact: "Kontakt",
  },
  home: {
    eyebrow: "Klinisk peptidhudvård",
    title: "Vetenskap för en synligt friskare hud.",
    subtitle:
      "Rena, kliniskt doserade peptidformuleringar utvecklade i Sverige — för fastare, slätare och mer återhämtad hud, dag för dag.",
    primaryCta: "Handla sortimentet",
    secondaryCta: "Vår vetenskap",
    rating: "4.9 / 5 — 1 820 verifierade recensioner",
    productsEyebrow: "Sortimentet",
    productsTitle: "En komplett peptidrutin",
    productsSubtitle: "Fyra produkter — formulerade för att fungera tillsammans eller var för sig.",
    ritualEyebrow: "Ritualen",
    ritualTitle: "Tre lugna steg",
    ritualSteps: [
      { n: "01", t: "Rengör", d: "Börja med ren och lätt fuktig hud för optimal absorption." },
      { n: "02", t: "Applicera", d: "Massera in serum eller booster i ansikte och hals." },
      { n: "03", t: "Lås in", d: "Avsluta med en peptidkräm för fukt och långvarig effekt." },
    ],
    ctaTitle: "Börja din peptidresa.",
    ctaSubtitle: "Få 10% rabatt på din första order när du anmäler dig till nyhetsbrevet.",
    ctaButton: "Utforska sortimentet",
  },
  about: {
    heroTitle: "Om PeptivaLab Group",
    heroSubtitle:
      "Vi tror att alla förtjänar hudvård som faktiskt fungerar — formulerad med kliniska doser av de mest effektiva peptiderna.",
    historyTitle: "Vår historia",
    historyBody:
      "PeptivaLab Group grundades 2020 i Stockholm av en biokemist och en hudterapeut som ville göra avancerad peptidhudvård tillgänglig utanför kliniker. Efter två års utveckling tillsammans med dermatologer lanserade vi vårt första Matrixyl-serum — och kundernas resultat talar för sig själva.",
    philosophyTitle: "Vår filosofi",
    philosophyBody:
      "Aktiva i kliniska doser, transparenta INCI-listor och förpackningar som skyddar formulan. Alla våra produkter är veganska, cruelty-free och fria från parabener, parfym och mineraloljor.",
    stats: [
      { n: "80k+", l: "Nöjda kunder" },
      { n: "4.9★", l: "Snittbetyg" },
      { n: "100%", l: "Vegan & CF" },
    ],
  },
  contact: {
    heroTitle: "Kontakta oss",
    heroSubtitle: "Vi svarar normalt inom 24 timmar på vardagar.",
    email: "hej@peptivalab.se",
    address: "Götgatan 12\n118 46 Stockholm",
    hours: "Mån–fre 9:00–17:00",
  },
  faq: {
    heroTitle: "Vanliga frågor",
    heroSubtitle: "Hittar du inte svaret? Kontakta oss så hjälper vi dig.",
    items: [
      { q: "Vad är peptider och vad gör de för huden?", a: "Peptider är korta kedjor av aminosyror som signalerar till huden att producera mer kollagen och elastin. Resultatet blir fastare, slätare och mer återhämtad hud över tid." },
      { q: "Hur lång tid tar leveransen?", a: "Vi skickar samma dag om du beställer före kl 14. Leverans tar normalt 1–3 arbetsdagar inom Sverige." },
      { q: "När ser jag resultat?", a: "De flesta märker en mjukare och mer återfuktad hud inom 1–2 veckor. Synlig förbättring av fina linjer och spänst syns vanligtvis efter 4–8 veckors daglig användning." },
      { q: "Kan jag använda peptider med retinol eller vitamin C?", a: "Ja. Peptider fungerar bra ihop med retinol (kvällstid) och vitamin C (morgon). Applicera peptidserumet först och låt det absorberas i en minut." },
      { q: "Är produkterna säkra för känslig hud och under graviditet?", a: "Ja, alla våra peptidformuleringar är dermatologiskt testade och anses säkra under graviditet och amning. Vid tveksamhet — rådfråga din läkare." },
      { q: "Kan jag returnera produkten?", a: "Vi erbjuder 30 dagars nöjdkundgaranti — även på öppnade produkter. Är du inte nöjd får du pengarna tillbaka." },
      { q: "Vilka betalningssätt accepterar ni?", a: "Vi tar emot Klarna (faktura och delbetalning), Swish, samt kort via Visa, Mastercard och Amex." },
    ],
  },
  products: {
    heroTitle: "Hela sortimentet",
    heroSubtitle: "Fyra peptidprodukter för en komplett rutin.",
  },
  footer: {
    blurb:
      "Premium peptidbaserad hudvård utvecklad i Sverige. Vetenskap och vård för en synligt fastare och friskare hud.",
    shopHeading: "Butik",
    helpHeading: "Hjälp",
    newsletterHeading: "Nyhetsbrev",
    newsletterBlurb: "10% rabatt på din första order.",
    copyright: "© {year} peptivaLab Group. Alla rättigheter förbehållna.",
  },
};

export type SiteContentMap = Partial<{
  [K in keyof SiteDefaults]: Partial<SiteDefaults[K]>;
}>;

/**
 * Deep-merge stored content over defaults. Empty strings/null/undefined fall
 * back to the default so a blank field in admin doesn't blank out the site.
 */
export function mergeContent(stored: SiteContentMap | null | undefined): SiteDefaults {
  const out = JSON.parse(JSON.stringify(siteDefaults)) as SiteDefaults;
  if (!stored) return out;
  for (const sectionKey of Object.keys(stored) as (keyof SiteDefaults)[]) {
    const section = stored[sectionKey];
    if (!section || typeof section !== "object") continue;
    const target = out[sectionKey] as Record<string, unknown>;
    for (const [k, v] of Object.entries(section)) {
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      target[k] = v;
    }
  }
  return out;
}
