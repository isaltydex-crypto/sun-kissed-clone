// Centralized SEO helpers. SITE_URL is build-time, used in canonical/og:url.
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://peptivalabgroup.com";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export function absUrl(path: string): string {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Build a consistent set of <head> tags for a route.
 * - title / description / og:* / twitter:* / canonical / og:url
 */
export function pageHead(opts: {
  path: string;            // route path, e.g. "/faq"
  title: string;
  description: string;
  image?: string;          // absolute or path; defaults to DEFAULT_OG_IMAGE
  type?: "website" | "article" | "product";
  jsonLd?: unknown | unknown[];
}) {
  const url = absUrl(opts.path);
  const image = absUrl(opts.image ?? DEFAULT_OG_IMAGE);
  const ogType = opts.type ?? "website";
  const meta = [
    { title: opts.title },
    { name: "description", content: opts.description },
    { property: "og:title", content: opts.title },
    { property: "og:description", content: opts.description },
    { property: "og:url", content: url },
    { property: "og:type", content: ogType },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: opts.title },
    { name: "twitter:description", content: opts.description },
    { name: "twitter:image", content: image },
  ];
  const links = [{ rel: "canonical", href: url }];
  const ldArr = Array.isArray(opts.jsonLd) ? opts.jsonLd : opts.jsonLd ? [opts.jsonLd] : [];
  const scripts = ldArr.map((data) => ({
    type: "application/ld+json",
    children: JSON.stringify(data),
  }));
  return { meta, links, scripts };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.path),
    })),
  };
}
