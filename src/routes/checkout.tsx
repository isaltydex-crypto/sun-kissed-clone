import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import {
  createCryptoInvoice,
  PAYMENTS_API_BASE_URL,
  type PayCurrency,
} from "@/lib/paymentsApi";
import { applyDiscountCode, type AppliedDiscount } from "@/lib/discounts";

const COINS: { value: PayCurrency; label: string; sub: string }[] = [
  { value: "btc", label: "Bitcoin", sub: "BTC" },
  { value: "eth", label: "Ethereum", sub: "ETH" },
  { value: "usdc", label: "USD Coin", sub: "USDC" },
  { value: "usdt", label: "Tether", sub: "USDT" },
];

const SHIPPING_FREE_OVER = 499;
const SHIPPING_COST = 49;

const schema = z.object({
  email: z.string().trim().email("Ange en giltig e-postadress").max(255),
  firstName: z.string().trim().min(1, "Förnamn krävs").max(80),
  lastName: z.string().trim().min(1, "Efternamn krävs").max(80),
  address: z.string().trim().min(1, "Adress krävs").max(200),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{3}\s?\d{2}$/, "Ange ett giltigt postnummer (t.ex. 123 45)"),
  city: z.string().trim().min(1, "Ort krävs").max(80),
  phone: z
    .string()
    .trim()
    .min(6, "Telefonnummer krävs")
    .max(20, "Telefonnummer för långt")
    .regex(/^[0-9+\s-]+$/, "Ogiltigt telefonnummer"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Du måste godkänna villkoren för att fortsätta" }),
  }),
});

type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Kassa — peptivaLab Group" },
      { name: "description", content: "Slutför din beställning av peptidhudvård från peptivaLab Group." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [payCurrency, setPayCurrency] = useState<PayCurrency>("btc");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

  const shipping = items.length === 0 ? 0 : subtotal >= SHIPPING_FREE_OVER ? 0 : SHIPPING_COST;
  const discountAmount = discount?.amount ?? 0;
  const total = Math.max(0, subtotal + shipping - discountAmount);

  const handleApplyDiscount = () => {
    setDiscountError(null);
    const result = applyDiscountCode(discountInput, subtotal);
    if (result.ok) {
      setDiscount(result.discount);
      setDiscountInput("");
    } else {
      setDiscount(null);
      setDiscountError(result.error);
    }
  };

  const handleRemoveDiscount = () => {
    setDiscount(null);
    setDiscountError(null);
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      address: "",
      postalCode: "",
      city: "",
      phone: "",
      notes: "",
      acceptTerms: false as unknown as true,
    },
  });

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);
    const orderId = `PL-${Date.now().toString(36).toUpperCase()}`;
    const order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customer: data,
      items,
      subtotal,
      shipping,
      discount,
      total,
      payCurrency,
    };
    try {
      sessionStorage.setItem("peptivalab.lastOrder", JSON.stringify(order));
    } catch {
      // ignore
    }

    // If a payments server is configured, create a Paymento invoice
    // through it and redirect the customer to the hosted checkout.
    if (PAYMENTS_API_BASE_URL) {
      try {
        const origin = window.location.origin;
        const { invoiceUrl } = await createCryptoInvoice({
          orderId,
          amount: total,
          currency: "SEK",
          payCurrency,
          customer: { ...data, notes: data.notes || undefined },
          items: items.map((i) => ({
            slug: i.slug,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          discountCode: discount?.code,
          successUrl: `${origin}/checkout/bekraftelse?order=${orderId}`,
          cancelUrl: `${origin}/checkout?cancelled=1`,
        });
        clear();
        window.location.href = invoiceUrl;
        return;
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Kunde inte starta betalningen. Försök igen.",
        );
        return;
      }
    }

    // No payments server configured yet — fall back to confirmation page.
    clear();
    navigate({ to: "/checkout/bekraftelse" });
  };

  if (items.length === 0) {
    return (
      <section className="bg-background py-20">
        <div className="mx-auto max-w-xl px-4 text-center md:px-8">
          <h1 className="text-3xl font-bold text-ocean-deep md:text-4xl">Din varukorg är tom</h1>
          <p className="mt-3 text-muted-foreground">
            Lägg till produkter innan du går till kassan.
          </p>
          <Link
            to="/produkter"
            className="mt-6 inline-block rounded-full bg-ocean-deep px-7 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean"
          >
            Till sortimentet
          </Link>
        </div>
      </section>
    );
  }

  const inputBase =
    "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ocean focus:outline-none focus:ring-2 focus:ring-ocean/30";
  const labelBase = "mb-1 block text-xs font-semibold uppercase tracking-wider text-ocean-deep";
  const errorClass = "mt-1 text-xs text-destructive";

  const errors = form.formState.errors;

  return (
    <section className="bg-background py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <header className="mb-8 md:mb-12">
          <h1 className="text-3xl font-bold text-ocean-deep md:text-4xl">Kassa</h1>
          <p className="mt-2 text-muted-foreground">
            Granska din beställning och fyll i dina leveransuppgifter.
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
          {/* Form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" noValidate>
            <fieldset className="space-y-4">
              <legend className="mb-2 text-lg font-semibold text-ocean-deep">Kontakt</legend>
              <div>
                <label htmlFor="email" className={labelBase}>E-post</label>
                <input id="email" type="email" autoComplete="email" maxLength={255} {...form.register("email")} className={inputBase} />
                {errors.email && <p className={errorClass}>{errors.email.message}</p>}
              </div>
              <div>
                <label htmlFor="phone" className={labelBase}>Telefon</label>
                <input id="phone" type="tel" autoComplete="tel" maxLength={20} {...form.register("phone")} className={inputBase} />
                {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="mb-2 text-lg font-semibold text-ocean-deep">Leverans</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className={labelBase}>Förnamn</label>
                  <input id="firstName" autoComplete="given-name" maxLength={80} {...form.register("firstName")} className={inputBase} />
                  {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
                </div>
                <div>
                  <label htmlFor="lastName" className={labelBase}>Efternamn</label>
                  <input id="lastName" autoComplete="family-name" maxLength={80} {...form.register("lastName")} className={inputBase} />
                  {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="address" className={labelBase}>Adress</label>
                <input id="address" autoComplete="street-address" maxLength={200} {...form.register("address")} className={inputBase} />
                {errors.address && <p className={errorClass}>{errors.address.message}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                <div>
                  <label htmlFor="postalCode" className={labelBase}>Postnummer</label>
                  <input id="postalCode" autoComplete="postal-code" maxLength={6} {...form.register("postalCode")} className={inputBase} />
                  {errors.postalCode && <p className={errorClass}>{errors.postalCode.message}</p>}
                </div>
                <div>
                  <label htmlFor="city" className={labelBase}>Ort</label>
                  <input id="city" autoComplete="address-level2" maxLength={80} {...form.register("city")} className={inputBase} />
                  {errors.city && <p className={errorClass}>{errors.city.message}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="notes" className={labelBase}>Meddelande (valfritt)</label>
                <textarea id="notes" rows={3} maxLength={500} {...form.register("notes")} className={inputBase} />
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-2 text-lg font-semibold text-ocean-deep">Betalning med krypto</legend>
              <p className="text-sm text-muted-foreground">
                Välj kryptovaluta. Du skickas vidare till en säker betalsida för att slutföra köpet.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {COINS.map((coin) => {
                  const active = payCurrency === coin.value;
                  return (
                    <button
                      type="button"
                      key={coin.value}
                      onClick={() => setPayCurrency(coin.value)}
                      aria-pressed={active}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-ocean-deep bg-ocean-deep/5 ring-2 ring-ocean/30"
                          : "border-border hover:border-ocean-deep/40 hover:bg-sand/40"
                      }`}
                    >
                      <p className="text-sm font-semibold text-ocean-deep">{coin.label}</p>
                      <p className="text-xs text-muted-foreground">{coin.sub}</p>
                    </button>
                  );
                })}
              </div>
              {!PAYMENTS_API_BASE_URL && (
                <p className="rounded-md border border-dashed border-border bg-sand/40 p-3 text-xs text-muted-foreground">
                  Betalningsservern är inte konfigurerad ännu. Sätt <code className="font-mono">VITE_PAYMENTS_API_BASE_URL</code> till din serverdomän för att aktivera kryptobetalningar.
                </p>
              )}
            </fieldset>

            {submitError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {submitError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link to="/produkter" className="text-sm font-medium text-ocean-deep underline-offset-4 hover:underline">
                ← Fortsätt handla
              </Link>
              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="rounded-full bg-ocean-deep px-8 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean disabled:opacity-60"
              >
                {form.formState.isSubmitting
                  ? "Bearbetar…"
                  : PAYMENTS_API_BASE_URL
                  ? "Betala med krypto"
                  : "Bekräfta beställning"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Genom att bekräfta godkänner du våra villkor. Betalningen hanteras säkert via Paymento.
            </p>
          </form>

          {/* Summary */}
          <aside className="h-fit rounded-2xl border border-border bg-sand/40 p-5 md:p-6">
            <h2 className="text-lg font-semibold text-ocean-deep">Din beställning</h2>
            <ul className="mt-4 divide-y divide-border">
              {items.map((item) => (
                <li key={item.slug} className="flex gap-3 py-3">
                  <div className="relative">
                    <img src={item.image} alt={item.name} className="h-16 w-16 rounded-md object-cover" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ocean-deep px-1 text-[10px] font-bold text-primary-foreground">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="mt-auto text-sm text-muted-foreground">
                      {item.quantity} × {item.price} kr
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-ocean-deep">{item.quantity * item.price} kr</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-border pt-4">
              <label htmlFor="discount" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ocean-deep">
                Rabattkod
              </label>
              {discount ? (
                <div className="flex items-center justify-between rounded-md border border-ocean-deep/30 bg-ocean-deep/5 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-ocean-deep">{discount.code}</p>
                    {discount.description && (
                      <p className="text-xs text-muted-foreground">{discount.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveDiscount}
                    className="text-xs font-medium text-destructive underline-offset-4 hover:underline"
                  >
                    Ta bort
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="discount"
                    type="text"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyDiscount();
                      }
                    }}
                    placeholder="Ange kod"
                    maxLength={32}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ocean focus:outline-none focus:ring-2 focus:ring-ocean/30"
                  />
                  <button
                    type="button"
                    onClick={handleApplyDiscount}
                    className="rounded-md bg-ocean-deep px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-ocean"
                  >
                    Använd
                  </button>
                </div>
              )}
              {discountError && <p className="mt-1 text-xs text-destructive">{discountError}</p>}
            </div>
            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delsumma</dt>
                <dd className="font-medium text-foreground">{subtotal} kr</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Frakt</dt>
                <dd className="font-medium text-foreground">{shipping === 0 ? "Fri" : `${shipping} kr`}</dd>
              </div>
              {discount && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Rabatt ({discount.code})</dt>
                  <dd className="font-medium text-ocean-deep">−{discount.amount} kr</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-3 text-base">
                <dt className="font-semibold text-ocean-deep">Totalt</dt>
                <dd className="font-bold text-ocean-deep">{total} kr</dd>
              </div>
            </dl>
            {shipping > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Fri frakt över {SHIPPING_FREE_OVER} kr.
              </p>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
