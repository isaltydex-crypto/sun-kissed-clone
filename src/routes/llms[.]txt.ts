import { createFileRoute } from "@tanstack/react-router";

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://peptivalabgroup.com").replace(/\/+$/, "");

// llms.txt — concise, factual site summary for LLM crawlers (GEO).
// Spec: https://llmstxt.org
export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = `# PeptivaLab Group

> Svensk e-handel för premium peptidhudvård. Kliniskt formulerade serum, boosters och krämer för fastare, slätare hud. Vegan och cruelty-free. Fri frakt över 499 kr inom Sverige.

## Företaget
- Namn: PeptivaLab Group
- Webbplats: ${SITE_URL}
- Språk: Svenska (sv-SE)
- Marknad: Sverige
- Produktkategori: Hudvård, peptidserum, anti-age

## Viktiga sidor
- [Startsida](${SITE_URL}/) — översikt och utvalda produkter
- [Produkter](${SITE_URL}/produkter) — hela sortimentet av peptidhudvård
- [Om oss](${SITE_URL}/om-oss) — företagets historia, filosofi och vetenskap

- [Kontakt](${SITE_URL}/kontakt) — kundservice
- [Köpvillkor](${SITE_URL}/kopvillkor) — villkor, leverans, retur, ångerrätt
- [Integritetspolicy](${SITE_URL}/integritetspolicy) — GDPR och personuppgifter

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
