import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import { useSiteContent } from "@/context/SiteContentContext";

export function SiteFooter() {
  const c = useSiteContent();
  return (
    <footer className="bg-ocean-deep text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-8">
        <div>
          <div className="flex items-center gap-3">
            <img src={logo} alt={c.brand.name} className="h-11 w-11 object-contain" />
            <span className="text-lg font-semibold">{c.brand.name}</span>
          </div>
          <p className="mt-4 text-sm text-primary-foreground/70">{c.footer.blurb}</p>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sun">{c.footer.shopHeading}</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/produkter" className="hover:text-sun">Alla produkter</Link></li>
            <li><Link to="/produkter" className="hover:text-sun">Serum</Link></li>
            <li><Link to="/produkter" className="hover:text-sun">Boosters</Link></li>
            <li><Link to="/produkter" className="hover:text-sun">Krämer</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sun">{c.footer.helpHeading}</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/faq" className="hover:text-sun">{c.menu.faq}</Link></li>
            <li><Link to="/kontakt" className="hover:text-sun">{c.menu.contact}</Link></li>
            <li><Link to="/om-oss" className="hover:text-sun">{c.menu.about}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sun">{c.footer.newsletterHeading}</h4>
          <p className="mb-3 text-sm text-primary-foreground/70">{c.footer.newsletterBlurb}</p>
          <form className="flex gap-2" aria-label={c.footer.newsletterHeading}>
            <label htmlFor="footer-newsletter-email" className="sr-only">Din e-post</label>
            <input id="footer-newsletter-email" name="email" type="email" autoComplete="email" placeholder="Din e-post" className="w-full rounded-md bg-white/10 px-3 py-2 text-sm placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-sun" />
            <button type="submit" className="rounded-md bg-sun px-3 py-2 text-sm font-semibold text-ocean-deep hover:bg-sun-deep">OK</button>
          </form>
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
