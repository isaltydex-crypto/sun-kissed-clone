import { Outlet, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CartProvider } from "@/context/CartContext";
import { ProductsProvider } from "@/context/ProductsContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { SiteContentProvider } from "@/context/SiteContentContext";
import { CartDrawer } from "@/components/CartDrawer";
import { IrcChat } from "@/components/IrcChat";

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

const ORG_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PeptivaLab Group",
  url: "https://peptivalab.se",
  logo: "https://peptivalab.se/favicon.ico",
  sameAs: [] as string[],
  contactPoint: [{
    "@type": "ContactPoint",
    contactType: "customer support",
    availableLanguage: ["sv", "en"],
  }],
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
      { title: "PeptivaLab Group — Premium peptidhudvård" },
      { name: "description", content: "Klinisk peptidhudvård för fastare, slätare hud. Serum, boosters och krämer — fri frakt över 499 kr." },
      { property: "og:title", content: "PeptivaLab Group — Premium peptidhudvård" },
      { property: "og:description", content: "Klinisk peptidhudvård för fastare, slätare hud." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "sv_SE" },
      { property: "og:site_name", content: "PeptivaLab Group" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0c2340" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap" },
    ],
    scripts: [
      { type: "application/ld+json", children: ORG_JSON_LD },
      ...(PLAUSIBLE_DOMAIN
        ? [{ src: PLAUSIBLE_SRC, defer: true, "data-domain": PLAUSIBLE_DOMAIN }]
        : []),
    ],
  }),
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
  const isAdmin = pathname.startsWith("/admin");
  return (
    <AdminAuthProvider>
      <SiteContentProvider>
        <ProductsProvider>
          <CartProvider>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <main className="flex-1">
                <Outlet />
              </main>
              <SiteFooter />
              <CartDrawer />
              {!isAdmin && <IrcChat />}
            </div>
          </CartProvider>
        </ProductsProvider>
      </SiteContentProvider>
    </AdminAuthProvider>
  );
}
