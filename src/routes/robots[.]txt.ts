import { createFileRoute } from "@tanstack/react-router";

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://peptivalab.se").replace(/\/+$/, "");

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body =
          `User-agent: *\n` +
          `Allow: /\n` +
          `Disallow: /admin\n` +
          `Disallow: /admin/\n` +
          `Disallow: /api/\n` +
          `Disallow: /checkout\n` +
          `\n` +
          `Sitemap: ${SITE_URL}/sitemap.xml\n`;
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
