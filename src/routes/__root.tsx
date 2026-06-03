import { Outlet, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CartProvider } from "@/context/CartContext";
import { ProductsProvider } from "@/context/ProductsContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { SiteContentProvider } from "@/context/SiteContentContext";
import { fetchSiteBundle } from "@/lib/site-content.functions";
import { CartDrawer } from "@/components/CartDrawer";
import { IrcChat } from "@/components/IrcChat";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Sidan hittades inte</h2>
        <p className="mt-2 text-sm text-muted-foreground">Sidan du letar efter finns inte eller har flyttats.</p>
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Tillbaka till hem
        </a>
      </div>
    </div>
  );
}

const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://peptivalabgroup.com";

const ORG_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "PeptivaLab Group",
  url: SITE_URL,
  logo: `${SITE_URL}/og-image.jpg`,
  description:
    "Svensk leverantör av högrena forskningspeptider — HPLC-verifierade, lyofiliserade och med CoA. Endast för laboratoriebruk.",
  areaServed: "SE",
  sameAs: [] as string[],
  contactPoint: [{
    "@type": "ContactPoint",
    contactType: "customer support",
    availableLanguage: ["sv", "en"],
    email: "kundservice@peptivalabgroup.com",
  }],
});

const WEBSITE_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "PeptivaLab Group",
  inLanguage: "sv-SE",
  publisher: { "@id": `${SITE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/produkter?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
});

const PLAUSIBLE_DOMAIN =
  (import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined) ?? "";
const PLAUSIBLE_SRC =
  (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) ??
  "https://plausible.io/js/script.js";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PeptivaLab Group — Forskningspeptider med ≥99% HPLC-renhet" },
      { name: "description", content: "Högrena forskningspeptider för universitet och biotech. HPLC-verifierade, lyofiliserade, CoA per batch. Endast för laboratoriebruk." },
      { property: "og:title", content: "PeptivaLab Group — Forskningspeptider" },
      { property: "og:description", content: "HPLC-verifierade peptider för vetenskapligt bruk. Endast för in vitro- och prekliniskt bruk." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "sv_SE" },
      { property: "og:site_name", content: "PeptivaLab Group" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0c2340" },
      { property: "og:image", content: `${SITE_URL}/og-image.jpg` },
      { name: "twitter:image", content: `${SITE_URL}/og-image.jpg` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap" },
      { rel: "alternate", type: "application/xml", href: `${SITE_URL}/sitemap.xml`, title: "Sitemap" },
    ],
    scripts: [
      { type: "application/ld+json", children: ORG_JSON_LD },
      { type: "application/ld+json", children: WEBSITE_JSON_LD },
      ...(PLAUSIBLE_DOMAIN
        ? [{ src: PLAUSIBLE_SRC, defer: true, "data-domain": PLAUSIBLE_DOMAIN }]
        : []),
    ],
  }),
  loader: () => fetchSiteBundle(),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const siteContentBundle = Route.useLoaderData();
  const isAdmin = pathname.startsWith("/admin");
  if (typeof window !== "undefined") {
    // Lazy install: avoids SSR work and only runs in the browser.
    void import("@/lib/diagnostics-client").then((m) => m.installClientDiagnostics());
  }
  return (
    <AdminAuthProvider>
      <SiteContentProvider initialBundle={siteContentBundle}>
        <ProductsProvider>
          <CartProvider>
            <div className="flex min-h-screen flex-col">
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-ocean-deep focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ocean"
              >
                Hoppa till innehåll
              </a>
              <SiteHeader />
              <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
                <Outlet />
              </main>
              <SiteFooter />
              <CartDrawer />
              {!isAdmin && <IrcChat />}
              <Toaster richColors position="top-right" />
            </div>
          </CartProvider>
        </ProductsProvider>
      </SiteContentProvider>
    </AdminAuthProvider>
  );
}
