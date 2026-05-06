import { Link } from "@tanstack/react-router";
import { ShoppingBag, Menu } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 md:py-4 md:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img src={logo} alt="peptivaLab Group" className="h-9 w-9 shrink-0 object-contain md:h-11 md:w-11" />
          <span className="truncate text-base font-semibold tracking-wide sm:text-lg">peptivaLab Group</span>
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
        <div className="flex items-center gap-1 sm:gap-3">
          <button className="relative rounded-full p-2 transition hover:bg-white/10" aria-label="Varukorg">
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sun text-[10px] font-bold text-ocean-deep">0</span>
          </button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="rounded-md p-2 hover:bg-white/10 md:hidden" aria-label="Öppna meny">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-ocean-deep text-primary-foreground border-l-white/10">
              <SheetHeader>
                <SheetTitle className="text-left text-primary-foreground">
                  <span className="flex items-center gap-2">
                    <img src={logo} alt="" className="h-8 w-8 object-contain" />
                    <span className="text-base font-semibold">peptivaLab Group</span>
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
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
