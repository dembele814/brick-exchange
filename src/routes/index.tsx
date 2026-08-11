import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listing-card";
import { listings, themes } from "@/data/listings";
import { ShieldCheck, Sparkles, Truck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Klockownia — marketplace zestawów i klocków LEGO" },
      {
        name: "description",
        content:
          "Kupuj i sprzedawaj używane zestawy, minifigurki i klocki LEGO. Przejrzyste opisy stanu, bezpieczne płatności i szybka wysyłka.",
      },
      { property: "og:title", content: "Klockownia — marketplace zestawów LEGO" },
      {
        property: "og:description",
        content: "Tysiące zestawów, minifigurek i klocków od kolekcjonerów z całej Polski.",
      },
    ],
  }),
  component: Index,
});

const sorts = ["Najnowsze", "Cena rosnąco", "Cena malejąco"] as const;

function Index() {
  const [theme, setTheme] = useState("Wszystkie");
  const [sort, setSort] = useState<(typeof sorts)[number]>("Najnowsze");

  const visible = useMemo(() => {
    const filtered =
      theme === "Wszystkie" ? listings : listings.filter((l) => l.theme === theme);
    const sorted = [...filtered];
    if (sort === "Cena rosnąco") sorted.sort((a, b) => a.price - b.price);
    if (sort === "Cena malejąco") sorted.sort((a, b) => b.price - a.price);
    return sorted;
  }, [theme, sort]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              Marketplace dla fanów klocków
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-[1.05] sm:text-5xl">
              Drugie życie każdego zestawu.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Kupuj kompletne zestawy, pojedyncze minifigurki i klocki na wagę — od
              kolekcjonerów, którzy dokładnie opisują stan każdego elementu.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/sprzedaj"
                className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
              >
                Wystaw zestaw w 2 minuty
              </Link>
              <span className="text-sm text-muted-foreground">
                Bez opłat za wystawienie
              </span>
            </div>

            <dl className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, t: "Ochrona kupującego", d: "Pieniądze trafiają do sprzedającego po odbiorze paczki." },
                { icon: Sparkles, t: "Weryfikacja kompletności", d: "Każda oferta ma listę braków i stan instrukcji." },
                { icon: Truck, t: "Wysyłka od 9 zł", d: "Paczkomaty i kurier w jednym kliknięciu." },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="card-surface p-4">
                  <Icon className="size-5 text-brand" aria-hidden />
                  <dt className="mt-3 text-sm font-semibold">{t}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
            {themes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                aria-pressed={theme === t}
                className={
                  theme === t
                    ? "rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    : "rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {visible.length} ofert{visible.length === 1 ? "a" : "y"}
            </h2>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Sortuj
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as (typeof sorts)[number])}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-ring/40"
              >
                {sorts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {visible.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground">
          <p>© 2026 Klockownia — niezależny serwis społeczności budujących.</p>
          <p>Nie jesteśmy powiązani z producentem klocków.</p>
        </div>
      </footer>
    </div>
  );
}
