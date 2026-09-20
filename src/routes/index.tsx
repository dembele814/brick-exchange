import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ListingCard } from "@/components/listing-card";
import { legoSeries, listings } from "@/data/listings";
import { usePublicListings } from "@/data/marketplace";
import { supabase } from "@/lib/supabase";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Klockogram — marketplace zestawów i klocków LEGO" },
      {
        name: "description",
        content:
          "Kupuj i sprzedawaj używane zestawy, minifigurki i klocki LEGO. Przejrzyste opisy stanu oraz bezpieczne płatności Stripe.",
      },
      { property: "og:title", content: "Klockogram — marketplace zestawów LEGO" },
      {
        property: "og:description",
        content: "Tysiące zestawów, minifigurek i klocków od kolekcjonerów z całej Polski.",
      },
    ],
  }),
  component: Index,
});

const sorts = ["Najnowsze", "Popularne"] as const;

function Index() {
  const { q } = Route.useSearch();
  const [theme, setTheme] = useState("Wszystkie");
  const [sort, setSort] = useState<(typeof sorts)[number]>("Najnowsze");
  const [query, setQuery] = useState(q ?? "");
  const { items: liveListings, loading, error, reload } = usePublicListings();
  const source = supabase ? liveListings : listings;

  useEffect(() => setQuery(q ?? ""), [q]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl");
    const filtered = source.filter((listing) => {
      const hasTheme = theme === "Wszystkie" || listing.theme === theme;
      const haystack =
        `${listing.title} ${listing.setNumber} ${listing.theme} ${listing.seller.name}`.toLocaleLowerCase(
          "pl",
        );
      return hasTheme && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
    const sorted = [...filtered];
    if (sort === "Popularne") {
      sorted.sort((a, b) => Number(b.promoted) - Number(a.promoted));
    }
    return sorted;
  }, [source, theme, sort, query]);

  const popularSeries = useMemo(() => {
    const counts = new Map<string, number>();
    source.forEach((listing) => {
      if (listing.complete) counts.set(listing.theme, (counts.get(listing.theme) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [source]);

  const promoted = useMemo(() => visible.filter((l) => l.promoted), [visible]);
  const regular = useMemo(() => visible.filter((l) => !l.promoted), [visible]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 sm:pt-9">
          <h1 className="sr-only">Oferty zestawów i klocków LEGO</h1>
          <div className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-card px-6 py-8 shadow-card sm:px-10 sm:py-9">
            <div className="absolute right-0 top-0 h-full w-1.5 bg-brand" />
            <div className="relative max-w-4xl">
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-brand">
                <Sparkles className="size-3.5 text-brand" /> MARKETPLACE DLA FANÓW KLOCKÓW
              </span>
              <h2 className="mt-5 font-display text-4xl font-bold leading-tight tracking-[-0.04em] sm:text-5xl">
                Kolekcje mają <span className="brand-gradient-text">drugie życie.</span>
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                Odkrywaj zestawy, minifigurki i części od społeczności, która zna ich prawdziwą
                wartość.
              </p>
              <Link
                to="/sprzedaj"
                className="button-gradient mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors"
              >
                Wystaw swoją ofertę <ArrowRight className="size-4" />
              </Link>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-brand" /> Bezpieczne płatności
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="size-4 text-brand" /> Profile sprzedających
                </span>
              </div>
            </div>
          </div>

          <label className="card-surface mb-4 flex items-center gap-3 px-4 py-3 sm:hidden">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj zestawu, numeru lub serii"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>

          <section className="card-surface p-5 sm:p-6" aria-labelledby="popular-series-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                  Odkrywaj
                </p>
                <h2 id="popular-series-heading" className="mt-1 text-xl font-bold">
                  Najpopularniejsze serie
                </h2>
              </div>
              <select
                aria-label="Wszystkie serie LEGO"
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
                className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="Wszystkie">Wszystkie serie</option>
                {legoSeries.map((series) => (
                  <option key={series} value={series}>
                    {series}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {popularSeries.map(([series, count]) => (
                <button
                  key={series}
                  type="button"
                  onClick={() => setTheme(series)}
                  aria-pressed={theme === series}
                  className={
                    theme === series
                      ? "button-gradient rounded-xl px-3.5 py-2 text-sm font-semibold"
                      : "rounded-xl border border-border bg-secondary/60 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand/35 hover:bg-brand-soft"
                  }
                >
                  {series} <span className="text-xs opacity-70">{count}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="mt-7 flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {loading
                ? "Szukamy ofert…"
                : `${visible.length} ofert${visible.length === 1 ? "a" : "y"}`}
            </h2>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Sortuj
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as (typeof sorts)[number])}
                className="rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring/40"
              >
                {sorts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3"
            >
              <p className="text-sm text-foreground">Nie udało się pobrać aktualnych ofert.</p>
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                Spróbuj ponownie
              </button>
            </div>
          )}

          {promoted.length > 0 && (
            <section className="mt-6 rounded-2xl border border-brand/25 bg-card p-4 shadow-card sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <span className="grid size-8 place-items-center rounded-full bg-card shadow-card">
                  <Sparkles className="size-4 text-brand" aria-hidden />
                </span>
                Wyróżnione oferty
              </h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {promoted.map((l) => (
                  <ListingCard key={`promoted-${l.id}`} listing={l} />
                ))}
              </div>
            </section>
          )}

          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {regular.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
          {!loading && visible.length === 0 && (
            <div className="card-surface mt-6 p-10 text-center">
              <Search className="mx-auto size-7 text-brand" />
              <h2 className="mt-3 text-lg font-semibold">Nie znaleźliśmy takich klocków</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Spróbuj innej nazwy, numeru zestawu albo wyczyść filtr serii.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setTheme("Wszystkie");
                }}
                className="mt-5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary"
              >
                Wyczyść filtry
              </button>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
