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
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 py-3 md:px-8 md:py-4">
      <button
        className="pointer-events-auto relative rounded-full bg-ocean-deep/85 p-2.5 text-primary-foreground shadow-md backdrop-blur transition hover:bg-ocean-deep"
        aria-label="Varukorg"
      >
        <ShoppingBag className="h-5 w-5" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sun text-[10px] font-bold text-ocean-deep">
          0
        </span>
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
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
