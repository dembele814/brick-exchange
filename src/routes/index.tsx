import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ListingCard } from "@/components/listing-card";
import { legoSeries, listings, themes } from "@/data/listings";

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

  const promoted = useMemo(() => visible.filter((l) => l.promoted), [visible]);
  const regular = useMemo(() => visible.filter((l) => !l.promoted), [visible]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-5">
          <h1 className="sr-only">Oferty zestawów i klocków LEGO</h1>

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
            <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              Wszystkie serie
              <select
                value={themes.includes(theme) ? "" : theme}
                onChange={(e) => setTheme(e.target.value || "Wszystkie")}
                className="max-w-[15rem] rounded-full border border-border bg-card px-3 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-ring/40"
              >
                <option value="">Wybierz serię…</option>
                {legoSeries.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between">
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

          {promoted.length > 0 && (
            <section className="mt-6 rounded-2xl border border-border bg-gradient-to-r from-sun/10 to-transparent p-4 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Sparkles className="size-5 text-sun-foreground" aria-hidden />
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
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
