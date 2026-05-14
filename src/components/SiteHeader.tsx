import { Link } from "@tanstack/react-router";
import { ShoppingBag, Menu } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useSiteContent, useCustomPages } from "@/context/SiteContentContext";
import logo from "@/assets/logo.png";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { count, openCart } = useCart();
  const content = useSiteContent();
  const pages = useCustomPages();
  const nav = [
    { to: "/", label: content.menu.home },
    { to: "/produkter", label: content.menu.products },
    { to: "/om-oss", label: content.menu.about },
    { to: "/kontakt", label: content.menu.contact },
  ];
  const customMenuPages = pages.filter((p) => p.in_menu);

  return (
    <>
      {/* Desktop header */}
      <header className="sticky top-0 z-50 hidden bg-ocean-deep text-primary-foreground shadow-lg md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="peptivaLab Group" className="h-11 w-11 object-contain" />
          </Link>
          <nav className="flex items-center gap-8" aria-label="Huvudmeny">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="text-sm font-medium uppercase tracking-wider text-primary-foreground/80 transition hover:text-sun focus:outline-none focus-visible:ring-2 focus-visible:ring-sun focus-visible:rounded-sm"
                activeProps={{ className: "text-sun", "aria-current": "page" }}
              >
                {n.label}
              </Link>
            ))}
            {customMenuPages.map((p) => (
              <Link
                key={p.id}
                to="/sida/$slug"
                params={{ slug: p.slug }}
                className="text-sm font-medium uppercase tracking-wider text-primary-foreground/80 transition hover:text-sun focus:outline-none focus-visible:ring-2 focus-visible:ring-sun focus-visible:rounded-sm"
                activeProps={{ className: "text-sun", "aria-current": "page" }}
              >
                {p.menu_label || p.title}
              </Link>
            ))}
          </nav>
          <button
            onClick={openCart}
            className="relative rounded-full p-2 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sun"
            aria-label={count > 0 ? `Varukorg, ${count} ${count === 1 ? "produkt" : "produkter"}` : "Varukorg, tom"}
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            {count > 0 && (
              <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sun px-1 text-[10px] font-bold text-ocean-deep">
                {count}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile floating buttons + side menu */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 py-3 md:hidden">
        <button
          onClick={openCart}
          className="pointer-events-auto relative rounded-full bg-ocean-deep/85 p-2.5 text-primary-foreground shadow-md backdrop-blur transition hover:bg-ocean-deep"
          aria-label="Varukorg"
        >
          <ShoppingBag className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sun px-1 text-[10px] font-bold text-ocean-deep">
              {count}
            </span>
          )}
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className="pointer-events-auto rounded-full bg-ocean-deep/85 p-2.5 text-primary-foreground shadow-md backdrop-blur transition hover:bg-ocean-deep"
              aria-label="Öppna meny"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-ocean-deep text-primary-foreground border-l-white/10">
            <SheetHeader>
              <SheetTitle className="text-primary-foreground">
                <span className="flex flex-col items-center">
                  <img src={logo} alt="peptivaLab Group" className="h-24 w-24 object-contain" />
                  <span
                    className="-mt-1 text-xl italic tracking-tight text-primary-foreground"
                    style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}
                  >
                    peptiva<span className="font-normal">Lab</span>
                    <span className="ml-1.5 align-middle text-[10px] not-italic uppercase tracking-[0.35em] text-sun">Group</span>
                  </span>
                </span>
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="border-b border-white/10 py-4 text-sm font-medium uppercase tracking-wider text-primary-foreground/85 transition hover:text-sun"
                  activeProps={{ className: "text-sun" }}
                >
                  {n.label}
                </Link>
              ))}
              {customMenuPages.map((p) => (
                <Link
                  key={p.id}
                  to="/sida/$slug"
                  params={{ slug: p.slug }}
                  onClick={() => setOpen(false)}
                  className="border-b border-white/10 py-4 text-sm font-medium uppercase tracking-wider text-primary-foreground/85 transition hover:text-sun"
                  activeProps={{ className: "text-sun" }}
                >
                  {p.menu_label || p.title}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
