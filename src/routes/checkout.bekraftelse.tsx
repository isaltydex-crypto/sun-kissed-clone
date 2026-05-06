import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

type Order = {
  id: string;
  createdAt: string;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    address: string;
    postalCode: string;
    city: string;
    phone: string;
    notes?: string;
  };
  items: { slug: string; name: string; price: number; quantity: number }[];
  subtotal: number;
  shipping: number;
  total: number;
};

export const Route = createFileRoute("/checkout/bekraftelse")({
  head: () => ({
    meta: [
      { title: "Tack för din beställning — peptivaLab Group" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("peptivalab.lastOrder");
      if (raw) setOrder(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  if (!order) {
    return (
      <section className="bg-background py-20">
        <div className="mx-auto max-w-xl px-4 text-center md:px-8">
          <h1 className="text-3xl font-bold text-ocean-deep md:text-4xl">Ingen beställning hittades</h1>
          <p className="mt-3 text-muted-foreground">Det ser ut som att du inte har någon aktiv beställning.</p>
          <Link to="/produkter" className="mt-6 inline-block rounded-full bg-ocean-deep px-7 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean">
            Till sortimentet
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background py-12 md:py-20">
      <div className="mx-auto max-w-2xl px-4 md:px-8">
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-12 w-12 text-ocean" />
          <h1 className="mt-4 text-3xl font-bold text-ocean-deep md:text-4xl">Tack för din beställning!</h1>
          <p className="mt-2 text-muted-foreground">
            En orderbekräftelse skickas till <span className="font-medium text-foreground">{order.customer.email}</span>.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Ordernummer: <span className="font-mono font-semibold text-ocean-deep">{order.id}</span></p>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-sand/40 p-5 md:p-6">
          <h2 className="text-lg font-semibold text-ocean-deep">Sammanställning</h2>
          <ul className="mt-4 divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.slug} className="flex justify-between py-3 text-sm">
                <span className="text-foreground">{item.quantity} × {item.name}</span>
                <span className="font-medium text-ocean-deep">{item.quantity * item.price} kr</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delsumma</dt>
              <dd className="font-medium text-foreground">{order.subtotal} kr</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Frakt</dt>
              <dd className="font-medium text-foreground">{order.shipping === 0 ? "Fri" : `${order.shipping} kr`}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base">
              <dt className="font-semibold text-ocean-deep">Totalt</dt>
              <dd className="font-bold text-ocean-deep">{order.total} kr</dd>
            </div>
          </dl>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ocean-deep">Levereras till</h3>
            <p className="mt-2 text-sm text-foreground">
              {order.customer.firstName} {order.customer.lastName}<br />
              {order.customer.address}<br />
              {order.customer.postalCode} {order.customer.city}
            </p>
          </div>
          <div className="rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ocean-deep">Kontakt</h3>
            <p className="mt-2 text-sm text-foreground">
              {order.customer.email}<br />
              {order.customer.phone}
            </p>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <Link to="/produkter" className="rounded-full border border-ocean-deep/20 px-7 py-3 text-sm font-semibold uppercase tracking-wider text-ocean-deep transition hover:bg-sand">
            Fortsätt handla
          </Link>
        </div>
      </div>
    </section>
  );
}
