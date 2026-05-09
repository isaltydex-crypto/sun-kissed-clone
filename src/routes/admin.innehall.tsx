import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import {
  adminFetchAll,
  adminSaveSection,
} from "@/server/site-content.functions";
import { siteDefaults, type SiteDefaults } from "@/lib/site-defaults";

export const Route = createFileRoute("/admin/innehall")({
  head: () => ({
    meta: [
      { title: "Admin — Innehåll" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminContentPage,
});

type SectionKey = keyof SiteDefaults;

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; msg: string };

function AdminContentPage() {
  const [content, setContent] = useState<SiteDefaults>(siteDefaults);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await adminFetchAll({ data: {} as never });
        setContent(res.merged);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateField = <K extends SectionKey>(section: K, field: keyof SiteDefaults[K], value: unknown) => {
    setContent((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const saveSection = async (key: SectionKey) => {
    setStatus((s) => ({ ...s, [key]: { kind: "saving" } }));
    try {
      await adminSaveSection({ data: { key, value: content[key] } });
      setStatus((s) => ({ ...s, [key]: { kind: "saved" } }));
      setTimeout(() => setStatus((s) => ({ ...s, [key]: { kind: "idle" } })), 1500);
    } catch (e) {
      setStatus((s) => ({ ...s, [key]: { kind: "error", msg: (e as Error).message } }));
    }
  };

  if (loading) return <div className="p-10 text-center text-muted-foreground">Laddar…</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-8">
        <Link to="/admin/produkter" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-foreground">Sajtinnehåll</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Redigera texter på sajten. Lämna ett fält tomt för att återställa till standardvärdet.
        </p>
        {error && <p className="mt-4 rounded bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        <Section title="Varumärke" status={status.brand} onSave={() => saveSection("brand")}>
          <TextField label="Namn" value={content.brand.name} onChange={(v) => updateField("brand", "name", v)} />
          <TextField label="Tagline" value={content.brand.tagline} onChange={(v) => updateField("brand", "tagline", v)} />
        </Section>

        <Section title="Meny" status={status.menu} onSave={() => saveSection("menu")}>
          {(Object.keys(content.menu) as (keyof SiteDefaults["menu"])[]).map((k) => (
            <TextField key={k} label={k} value={content.menu[k]} onChange={(v) => updateField("menu", k, v)} />
          ))}
        </Section>

        <Section title="Startsida" status={status.home} onSave={() => saveSection("home")}>
          <TextField label="Eyebrow" value={content.home.eyebrow} onChange={(v) => updateField("home", "eyebrow", v)} />
          <TextField label="Rubrik" value={content.home.title} onChange={(v) => updateField("home", "title", v)} />
          <TextArea label="Underrubrik" value={content.home.subtitle} onChange={(v) => updateField("home", "subtitle", v)} />
          <TextField label="Knapp 1" value={content.home.primaryCta} onChange={(v) => updateField("home", "primaryCta", v)} />
          <TextField label="Knapp 2" value={content.home.secondaryCta} onChange={(v) => updateField("home", "secondaryCta", v)} />
          <TextField label="Betyg-text" value={content.home.rating} onChange={(v) => updateField("home", "rating", v)} />
          <TextField label="Produkter — eyebrow" value={content.home.productsEyebrow} onChange={(v) => updateField("home", "productsEyebrow", v)} />
          <TextField label="Produkter — rubrik" value={content.home.productsTitle} onChange={(v) => updateField("home", "productsTitle", v)} />
          <TextArea label="Produkter — text" value={content.home.productsSubtitle} onChange={(v) => updateField("home", "productsSubtitle", v)} />
          <TextField label="Ritual — eyebrow" value={content.home.ritualEyebrow} onChange={(v) => updateField("home", "ritualEyebrow", v)} />
          <TextField label="Ritual — rubrik" value={content.home.ritualTitle} onChange={(v) => updateField("home", "ritualTitle", v)} />
          <RepeaterField
            label="Ritual-steg"
            items={content.home.ritualSteps}
            empty={{ n: "", t: "", d: "" }}
            onChange={(v) => updateField("home", "ritualSteps", v)}
            fields={[
              { key: "n", label: "Nr" },
              { key: "t", label: "Titel" },
              { key: "d", label: "Beskrivning", textarea: true },
            ]}
          />
          <TextField label="CTA — rubrik" value={content.home.ctaTitle} onChange={(v) => updateField("home", "ctaTitle", v)} />
          <TextArea label="CTA — text" value={content.home.ctaSubtitle} onChange={(v) => updateField("home", "ctaSubtitle", v)} />
          <TextField label="CTA — knapp" value={content.home.ctaButton} onChange={(v) => updateField("home", "ctaButton", v)} />
        </Section>

        <Section title="Om oss" status={status.about} onSave={() => saveSection("about")}>
          <TextField label="Hero-rubrik" value={content.about.heroTitle} onChange={(v) => updateField("about", "heroTitle", v)} />
          <TextArea label="Hero-text" value={content.about.heroSubtitle} onChange={(v) => updateField("about", "heroSubtitle", v)} />
          <TextField label="Historia — rubrik" value={content.about.historyTitle} onChange={(v) => updateField("about", "historyTitle", v)} />
          <TextArea label="Historia — text" value={content.about.historyBody} onChange={(v) => updateField("about", "historyBody", v)} rows={5} />
          <TextField label="Filosofi — rubrik" value={content.about.philosophyTitle} onChange={(v) => updateField("about", "philosophyTitle", v)} />
          <TextArea label="Filosofi — text" value={content.about.philosophyBody} onChange={(v) => updateField("about", "philosophyBody", v)} rows={5} />
          <RepeaterField
            label="Statistik"
            items={content.about.stats}
            empty={{ n: "", l: "" }}
            onChange={(v) => updateField("about", "stats", v)}
            fields={[
              { key: "n", label: "Värde" },
              { key: "l", label: "Etikett" },
            ]}
          />
        </Section>

        <Section title="Kontakt" status={status.contact} onSave={() => saveSection("contact")}>
          <TextField label="Hero-rubrik" value={content.contact.heroTitle} onChange={(v) => updateField("contact", "heroTitle", v)} />
          <TextArea label="Hero-text" value={content.contact.heroSubtitle} onChange={(v) => updateField("contact", "heroSubtitle", v)} />
          <TextField label="E-post" value={content.contact.email} onChange={(v) => updateField("contact", "email", v)} />
          <TextArea label="Adress" value={content.contact.address} onChange={(v) => updateField("contact", "address", v)} />
          <TextField label="Öppettider" value={content.contact.hours} onChange={(v) => updateField("contact", "hours", v)} />
        </Section>

        <Section title="FAQ" status={status.faq} onSave={() => saveSection("faq")}>
          <TextField label="Hero-rubrik" value={content.faq.heroTitle} onChange={(v) => updateField("faq", "heroTitle", v)} />
          <TextArea label="Hero-text" value={content.faq.heroSubtitle} onChange={(v) => updateField("faq", "heroSubtitle", v)} />
          <RepeaterField
            label="Frågor & svar"
            items={content.faq.items}
            empty={{ q: "", a: "" }}
            onChange={(v) => updateField("faq", "items", v)}
            fields={[
              { key: "q", label: "Fråga" },
              { key: "a", label: "Svar", textarea: true },
            ]}
          />
        </Section>

        <Section title="Produktsida" status={status.products} onSave={() => saveSection("products")}>
          <TextField label="Hero-rubrik" value={content.products.heroTitle} onChange={(v) => updateField("products", "heroTitle", v)} />
          <TextArea label="Hero-text" value={content.products.heroSubtitle} onChange={(v) => updateField("products", "heroSubtitle", v)} />
        </Section>

        <Section title="Footer" status={status.footer} onSave={() => saveSection("footer")}>
          <TextArea label="Beskrivning" value={content.footer.blurb} onChange={(v) => updateField("footer", "blurb", v)} />
          <TextField label="Butik-rubrik" value={content.footer.shopHeading} onChange={(v) => updateField("footer", "shopHeading", v)} />
          <TextField label="Hjälp-rubrik" value={content.footer.helpHeading} onChange={(v) => updateField("footer", "helpHeading", v)} />
          <TextField label="Nyhetsbrev — rubrik" value={content.footer.newsletterHeading} onChange={(v) => updateField("footer", "newsletterHeading", v)} />
          <TextField label="Nyhetsbrev — text" value={content.footer.newsletterBlurb} onChange={(v) => updateField("footer", "newsletterBlurb", v)} />
          <TextField label="Copyright (använd {year})" value={content.footer.copyright} onChange={(v) => updateField("footer", "copyright", v)} />
        </Section>

        <Section
          title="Mailmallar"
          status={status.emails}
          onSave={() => saveSection("emails")}
        >
          <p className="-mt-2 text-xs text-muted-foreground">
            Mallar för automatiska mejl. Använd platshållare som <code className="rounded bg-muted px-1">{"{{name}}"}</code> — de byts ut när mejlet skickas.
          </p>
          <TextField label="Avsändarnamn (rubrik i mejl)" value={content.emails.brandHeader} onChange={(v) => updateField("emails", "brandHeader", v)} />
          <TextField label="Sidfot i mejl" value={content.emails.footer} onChange={(v) => updateField("emails", "footer", v)} />

          <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-sm font-semibold">Kontaktformulär</p>
            <p className="text-xs text-muted-foreground">Platshållare: <code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{message}}"}</code>, <code>{"{{timestamp}}"}</code></p>
          </div>
          <TextField label="Ämne" value={content.emails.contactSubject} onChange={(v) => updateField("emails", "contactSubject", v)} />
          <TextArea label="Meddelande" value={content.emails.contactBody} onChange={(v) => updateField("emails", "contactBody", v)} />

          <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-sm font-semibold">Driftlarm (backup &amp; verify)</p>
            <p className="text-xs text-muted-foreground">Platshållare: <code>{"{{job}}"}</code>, <code>{"{{host}}"}</code>, <code>{"{{startedAt}}"}</code>, <code>{"{{failedAt}}"}</code>, <code>{"{{exitCode}}"}</code>, <code>{"{{log}}"}</code></p>
          </div>
          <TextField label="Ämne" value={content.emails.alertSubject} onChange={(v) => updateField("emails", "alertSubject", v)} />
          <TextArea label="Meddelande" value={content.emails.alertBody} onChange={(v) => updateField("emails", "alertBody", v)} />
        </Section>
      </div>
    </div>
  );
}

// ---------- helpers ----------

function Section({ title, children, status, onSave }: { title: string; children: ReactNode; status?: Status; onSave: () => void }) {
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <button
          onClick={onSave}
          disabled={status?.kind === "saving"}
          className="inline-flex items-center gap-2 rounded-md bg-ocean-deep px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-ocean disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {status?.kind === "saving" ? "Sparar…" : status?.kind === "saved" ? "Sparat ✓" : "Spara"}
        </button>
      </div>
      {status?.kind === "error" && <p className="mt-2 text-sm text-destructive">{status.msg}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
      />
    </label>
  );
}

type RepeaterFieldDef = { key: string; label: string; textarea?: boolean };

function RepeaterField<T extends Record<string, string>>({
  label,
  items,
  empty,
  fields,
  onChange,
}: {
  label: string;
  items: T[];
  empty: T;
  fields: RepeaterFieldDef[];
  onChange: (v: T[]) => void;
}) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-2 space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-2">
                {fields.map((f) =>
                  f.textarea ? (
                    <TextArea
                      key={f.key}
                      label={f.label}
                      value={(item[f.key] ?? "") as string}
                      onChange={(v) => {
                        const next = [...items];
                        next[i] = { ...next[i], [f.key]: v };
                        onChange(next);
                      }}
                    />
                  ) : (
                    <TextField
                      key={f.key}
                      label={f.label}
                      value={(item[f.key] ?? "") as string}
                      onChange={(v) => {
                        const next = [...items];
                        next[i] = { ...next[i], [f.key]: v };
                        onChange(next);
                      }}
                    />
                  ),
                )}
              </div>
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="rounded p-1 text-destructive hover:bg-destructive/10"
                aria-label="Ta bort"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={() => onChange([...items, { ...empty }])}
          className="inline-flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <Plus className="h-4 w-4" /> Lägg till
        </button>
      </div>
    </div>
  );
}
