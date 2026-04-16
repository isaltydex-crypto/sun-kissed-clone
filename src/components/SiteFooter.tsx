import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="bg-ocean-deep text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sun font-bold text-ocean-deep">S</span>
            <span className="text-lg font-semibold">SOLDIS</span>
          </div>
          <p className="mt-4 text-sm text-primary-foreground/70">
            Premium självbruna produkter utan sol och utan UV. Sveriges nya favorit för en naturlig solbränna.
          </p>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sun">Butik</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/produkter" className="hover:text-sun">Alla produkter</Link></li>
            <li><Link to="/produkter" className="hover:text-sun">Mousse</Link></li>
            <li><Link to="/produkter" className="hover:text-sun">Droppar</Link></li>
            <li><Link to="/produkter" className="hover:text-sun">Mist</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sun">Hjälp</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li><Link to="/faq" className="hover:text-sun">Vanliga frågor</Link></li>
            <li><Link to="/kontakt" className="hover:text-sun">Kontakta oss</Link></li>
            <li><Link to="/om-oss" className="hover:text-sun">Om oss</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-sun">Nyhetsbrev</h4>
          <p className="mb-3 text-sm text-primary-foreground/70">10% rabatt på din första order.</p>
          <form className="flex gap-2">
            <input type="email" placeholder="Din e-post" className="w-full rounded-md bg-white/10 px-3 py-2 text-sm placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-sun" />
            <button type="submit" className="rounded-md bg-sun px-3 py-2 text-sm font-semibold text-ocean-deep hover:bg-sun-deep">OK</button>
          </form>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-xs text-primary-foreground/60 md:px-8">
          © {new Date().getFullYear()} Soldis. Alla rättigheter förbehållna.
        </div>
      </div>
    </footer>
  );
}
