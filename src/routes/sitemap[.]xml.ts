import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://peptivalab.se").replace(/\/+$/, "");

const STATIC_PATHS = [
  { path: "/",          changefreq: "weekly",  priority: 1.0 },
  { path: "/produkter", changefreq: "weekly",  priority: 0.9 },
  { path: "/om-oss",    changefreq: "monthly", priority: 0.6 },
  { path: "/kontakt",   changefreq: "monthly", priority: 0.6 },
  { path: "/faq",       changefreq: "monthly", priority: 0.5 },
];

function xmlEscape(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { data: pages } = await supabaseAdmin
          .from("site_pages")
          .select("slug, updated_at")
          .eq("published", true);

        const urls = [
          ...STATIC_PATHS.map((p) => ({ loc: `${SITE_URL}${p.path}`, lastmod: undefined as string | undefined, changefreq: p.changefreq, priority: p.priority })),
          ...(pages ?? []).map((p) => ({
            loc: `${SITE_URL}/sida/${p.slug}`,
            lastmod: p.updated_at ?? undefined,
            changefreq: "monthly",
            priority: 0.5,
          })),
        ];

        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls
            .map(
              (u) =>
                `  <url>\n` +
                `    <loc>${xmlEscape(u.loc)}</loc>\n` +
                (u.lastmod ? `    <lastmod>${xmlEscape(new Date(u.lastmod).toISOString().slice(0, 10))}</lastmod>\n` : "") +
                `    <changefreq>${u.changefreq}</changefreq>\n` +
                `    <priority>${u.priority.toFixed(1)}</priority>\n` +
                `  </url>`,
            )
            .join("\n") +
          `\n</urlset>\n`;

        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
