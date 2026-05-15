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
    heroImage: string;
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
    name: "PeptivaLab Group",
    tagline: "Högrena forskningspeptider — endast för laboratoriebruk.",
  },
  menu: {
    home: "Hem",
    products: "Produkter",
    about: "Om oss",
    faq: "FAQ",
    contact: "Kontakt",
  },
  home: {
    heroImage: "",
    eyebrow: "Forskningspeptider",
    title: "Högrena peptider för vetenskapligt bruk.",
    subtitle:
      "HPLC-verifierade forskningspeptider med ≥99% renhet. Lyofiliserade, GMP-tillverkade och levererade med fullständigt analyscertifikat (CoA) — för forskare, laboratorier och universitet.",
    primaryCta: "Se sortimentet",
    secondaryCta: "Om vår kvalitet",
    rating: "≥99% renhet — HPLC & masspektrometri på varje batch",
    productsEyebrow: "Sortiment",
    productsTitle: "Forskningspeptider i lager",
    productsSubtitle: "Lyofiliserade peptider med CoA. Endast för in vitro- och prekliniskt bruk.",
    ritualEyebrow: "Vår process",
    ritualTitle: "Tre steg från beställning till bänk",
    ritualSteps: [
      { n: "01", t: "Beställ", d: "Välj peptid och dosering. Verifierat akademiskt eller forskningssyfte krävs." },
      { n: "02", t: "Vi skickar", d: "Diskret förpackning med kylförvaring vid behov. Spårbar leverans inom 1–3 arbetsdagar." },
      { n: "03", t: "CoA & support", d: "Analyscertifikat (HPLC, MS) följer med varje order. Tekniska frågor besvaras av vårt labbteam." },
    ],
    ctaTitle: "Forskning förtjänar reproducerbara råvaror.",
    ctaSubtitle: "Anmäl dig till nyhetsbrevet för batch-uppdateringar, nya peptider och 10% rabatt på din första order.",
    ctaButton: "Utforska sortimentet",
  },
  about: {
    heroTitle: "Om PeptivaLab Group",
    heroSubtitle:
      "Svensk leverantör av högrena forskningspeptider för universitet, biotech och kliniska forskningsmiljöer — uteslutande för laboratoriebruk.",
    historyTitle: "Vår historia",
    historyBody:
      "PeptivaLab Group grundades 2020 i Stockholm av en peptidkemist och en molekylärbiolog som var trötta på inkonsekventa råvaror i sin egen forskning. Vi byggde ett nätverk av GMP-certifierade syntespartners och ett internt QC-labb för att garantera batch-till-batch-reproducerbarhet — och idag levererar vi till forskargrupper i hela Norden.",
    philosophyTitle: "Vår filosofi",
    philosophyBody:
      "Renhet, transparens och spårbarhet. Varje batch analyseras med HPLC och masspektrometri, och fullständig CoA följer med varje försändelse. Vi säljer endast till verifierade forskningsmiljöer och våra produkter är inte avsedda för humant eller veterinärt bruk.",
    stats: [
      { n: "≥99%", l: "HPLC-renhet" },
      { n: "500+", l: "Forskargrupper" },
      { n: "100%", l: "CoA per batch" },
    ],
  },
  contact: {
    heroTitle: "Kontakta oss",
    heroSubtitle: "Tekniska frågor, offert eller batch-data — vårt labbteam svarar inom 24 timmar på vardagar.",
    email: "research@peptivalabgroup.com",
    address: "Götgatan 12\n118 46 Stockholm",
    hours: "Mån–fre 9:00–17:00",
  },
  faq: {
    heroTitle: "Vanliga frågor",
    heroSubtitle: "Hittar du inte svaret? Kontakta vårt labbteam så hjälper vi dig.",
    items: [
      { q: "Är produkterna avsedda för humant bruk?", a: "Nej. Alla våra peptider säljs uteslutande för in vitro- och prekliniskt forskningsbruk. De är inte godkända som läkemedel, kosttillskott eller kosmetika och får inte administreras till människor eller djur." },
      { q: "Vilken renhet har era peptider?", a: "Samtliga peptider har minst 99% renhet enligt HPLC. Varje batch analyseras dessutom med masspektrometri (ESI-MS eller MALDI-TOF) för att verifiera molekylvikt och sekvens." },
      { q: "Får jag ett analyscertifikat (CoA)?", a: "Ja. Ett fullständigt CoA med HPLC-kromatogram, MS-spektra, peptidinnehåll och endotoxinnivå följer med varje order. Äldre batchcertifikat finns på begäran." },
      { q: "Hur ska peptiderna förvaras?", a: "Lyofiliserade peptider förvaras vid -20°C och är stabila i minst 24 månader. Efter rekonstituering med bakteriostatiskt vatten — förvara vid 2–8°C och använd inom 30 dagar för optimal stabilitet." },
      { q: "Vem får beställa?", a: "Vi säljer endast till verifierade forskningsmiljöer: universitet, forskningsinstitut, sjukhus och biotech-företag. Vid beställning kan vi begära intyg om forskningssyfte eller institutionell tillhörighet." },
      { q: "Hur lång tid tar leveransen?", a: "Lagervaror skickas samma dag vid order före kl 14. Leverans inom Sverige tar 1–3 arbetsdagar med spårbar transport. Kylkrävande peptider skickas med isolerande emballage och kylklampar." },
      { q: "Kan jag returnera peptider?", a: "Av kvalitets- och säkerhetsskäl tas inte öppnade peptider tillbaka. Skadat eller felaktigt levererat gods ersätts kostnadsfritt om det reklameras inom 7 dagar från mottagandet." },
    ],
  },
  products: {
    heroTitle: "Forskningspeptider",
    heroSubtitle: "HPLC-verifierade peptider med ≥99% renhet. CoA medföljer varje order. Endast för laboratoriebruk.",
  },
  footer: {
    blurb:
      "Svensk leverantör av högrena forskningspeptider. HPLC-verifierade, lyofiliserade och levererade med CoA — endast för in vitro- och prekliniskt bruk.",
    shopHeading: "Sortiment",
    helpHeading: "Information",
    newsletterHeading: "Nyhetsbrev",
    newsletterBlurb: "Batch-uppdateringar och 10% rabatt på din första order.",
    copyright: "© {year} PeptivaLab Group. Alla rättigheter förbehållna. Endast för forskningsbruk — ej avsedd för humant eller veterinärt bruk.",
  },
  emails: {
    brandHeader: "PeptivaLab Group — Research Peptides",
    footer: "Detta är ett automatiskt mejl från peptivalabgroup.com — svara inte direkt. Endast för forskningsbruk.",
    contactSubject: "Ny forskningsförfrågan från {{name}}",
    contactBody:
      "Hej!\n\nDu har fått en ny förfrågan via kontaktformuläret på peptivalabgroup.com.\n\nNamn:    {{name}}\nE-post:  {{email}}\nTid:     {{timestamp}}\n\nMeddelande:\n{{message}}\n\nSvara direkt på detta mejl för att besvara förfrågan.",
    alertSubject: "[PeptivaLab] {{job}} misslyckades på {{host}}",
    alertBody:
      "Ett schemalagt jobb har misslyckats.\n\nJobb:      {{job}}\nServer:    {{host}}\nStartade:  {{startedAt}}\nFelade:    {{failedAt}}\nExit-kod:  {{exitCode}}\n\nSista raderna ur loggen:\n{{log}}\n\nKontrollera servern och åtgärda problemet så snart som möjligt.",
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
