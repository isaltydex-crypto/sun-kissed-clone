import { createFileRoute } from "@tanstack/react-router";

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://peptivalabgroup.com").replace(/\/+$/, "");

// llms.txt — concise, factual site summary for LLM crawlers (GEO).
// Spec: https://llmstxt.org
export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = `# PeptivaLab Group

> Svensk leverantör av högrena forskningspeptider för universitet, biotech och kliniska forskningsmiljöer. HPLC-verifierade ≥99%, lyofiliserade, CoA per batch. Endast för in vitro- och prekliniskt bruk — ej avsedd för humant eller veterinärt bruk.

## Företaget
- Namn: PeptivaLab Group
- Webbplats: ${SITE_URL}
- Språk: Svenska (sv-SE)
- Marknad: Norden
- Produktkategori: Forskningspeptider, laboratoriereagenser

## Viktiga sidor
- [Startsida](${SITE_URL}/) — översikt och utvalda peptider
- [Produkter](${SITE_URL}/produkter) — sortiment av forskningspeptider (BPC-157, TB-500, GHK-Cu, Ipamorelin)
- [Om oss](${SITE_URL}/om-oss) — företaget, QC-process och kvalitetspolicy

- [Kontakt](${SITE_URL}/kontakt) — kundservice

## Maskinläsbart
- [Sitemap](${SITE_URL}/sitemap.xml)
- [Robots](${SITE_URL}/robots.txt)
`;
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
