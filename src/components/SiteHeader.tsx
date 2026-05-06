import { Link } from "@tanstack/react-router";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";

const nav = [
  { to: "/", label: "Hem" },
  { to: "/produkter", label: "Produkter" },
  { to: "/om-oss", label: "Om oss" },
  { to: "/faq", label: "FAQ" },
  { to: "/kontakt", label: "Kontakt" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-ocean-deep text-primary-foreground shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sun font-bold text-ocean-deep">P</span>
          <span className="text-lg font-semibold tracking-wide">PEPTIVALAB</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-sm font-medium uppercase tracking-wider text-primary-foreground/80 transition hover:text-sun"
              activeProps={{ className: "text-sun" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button className="relative rounded-full p-2 transition hover:bg-white/10" aria-label="Varukorg">
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sun text-[10px] font-bold text-ocean-deep">0</span>
          </button>
          <button className="md:hidden rounded-md p-2 hover:bg-white/10" onClick={() => setOpen(!open)} aria-label="Meny">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-white/10 px-4 pb-4 md:hidden">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="block py-3 text-sm font-medium uppercase tracking-wider"
              activeProps={{ className: "text-sun" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
