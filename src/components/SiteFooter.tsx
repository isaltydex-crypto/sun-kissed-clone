import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import { useSiteContent } from "@/context/SiteContentContext";

export function SiteFooter() {
  const c = useSiteContent();
  return (
    <footer className="bg-ocean-deep text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-2 md:px-8">
        <div>
          <div className="flex items-center gap-3">
            <img src={logo} alt={c.brand.name} className="h-11 w-11 object-contain" />
            <span className="text-lg font-semibold">{c.brand.name}</span>
          </div>
          <p className="mt-4 text-sm text-primary-foreground/70">{c.footer.blurb}</p>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sun">{c.footer.helpHeading}</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/kontakt" className="hover:text-sun">{c.menu.contact}</Link></li>
            <li><Link to="/om-oss" className="hover:text-sun">{c.menu.about}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-xs text-primary-foreground/60 md:px-8">
          {c.footer.copyright.replace("{year}", String(new Date().getFullYear()))}
        </div>
      </div>
    </footer>
  );
}
