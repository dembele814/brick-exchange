import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ListingCard } from "@/components/listing-card";
import { legoSeries, listings } from "@/data/listings";
import { usePublicListings } from "@/data/marketplace";
import { supabase } from "@/lib/supabase";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({ q: typeof search["q"] === "string" ? search["q"] : undefined }),
  head: () => ({
    meta: [
      { title: "Klockogram — marketplace zestawów i klocków LEGO" },
      {
        name: "description",
        content:
          "Testuj kupowanie i sprzedawanie używanych zestawów, minifigurek i klocków LEGO. Przejrzyste opisy stanu i płatności testowe Stripe.",
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
      const haystack = `${listing.title} ${listing.setNumber} ${listing.theme} ${listing.seller.name}`.toLocaleLowerCase("pl");
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
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-5">
          <h1 className="sr-only">Oferty zestawów i klocków LEGO</h1>
          <div className="relative mb-8 overflow-hidden rounded-[2rem] bg-primary px-6 py-9 text-primary-foreground shadow-lift sm:px-10 sm:py-12">
            <div className="absolute -right-12 -top-20 size-72 rounded-full bg-sun/80 blur-3xl" />
            <div className="absolute -bottom-20 right-44 size-56 rounded-full bg-brand/70 blur-3xl" />
            <div className="relative max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-card/15 px-3 py-1.5 text-xs font-bold tracking-wide">
                <Sparkles className="size-3.5" /> DLA TYCH, KTÓRZY WIDZĄ WIĘCEJ
              </span>
              <h2 className="mt-5 font-display text-4xl font-bold leading-[0.96] sm:text-6xl">
                Daj klockom kolejne życie.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
                Zestawy z historią, części z potencjałem i kolekcjonerzy, którym można zaufać.
              </p>
              <Link to="/sprzedaj" className="mt-6 inline-flex items-center gap-2 rounded-full bg-card px-5 py-3 text-sm font-bold text-foreground transition-transform hover:-translate-y-0.5">
                Wystaw swoją ofertę <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          <label className="card-surface mb-4 flex items-center gap-3 px-4 py-3 sm:hidden">
            <Search className="size-4 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj zestawu, numeru lub serii" className="w-full bg-transparent text-sm outline-none" />
          </label>

          <section className="card-surface p-4 sm:p-5" aria-labelledby="popular-series-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Polecane</p>
                <h2 id="popular-series-heading" className="mt-1 text-lg font-semibold">Najpopularniejsze serie LEGO</h2>
              </div>
              <select
                aria-label="Wszystkie serie LEGO"
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="Wszystkie">Wszystkie serie</option>
                {legoSeries.map((series) => <option key={series} value={series}>{series}</option>)}
              </select>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {popularSeries.map(([series, count]) => (
                <button key={series} type="button" onClick={() => setTheme(series)} aria-pressed={theme === series} className={theme === series ? "rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground" : "rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-brand-soft"}>
                  {series} <span className="text-xs opacity-70">{count}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="mt-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {loading ? "Szukamy ofert…" : `${visible.length} ofert${visible.length === 1 ? "a" : "y"}`}
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

          {error && (
            <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-foreground">Nie udało się pobrać aktualnych ofert.</p>
              <button type="button" onClick={() => void reload()} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary">
                Spróbuj ponownie
              </button>
            </div>
          )}

          {promoted.length > 0 && (
            <section className="mt-6 rounded-3xl border border-border bg-gradient-to-br from-sun/25 via-grape-soft to-sky-soft p-4 sm:p-6">
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
              <p className="mt-1 text-sm text-muted-foreground">Spróbuj innej nazwy, numeru zestawu albo wyczyść filtr serii.</p>
              <button type="button" onClick={() => { setQuery(""); setTheme("Wszystkie"); }} className="mt-5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary">Wyczyść filtry</button>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
