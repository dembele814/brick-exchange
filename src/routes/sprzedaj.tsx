import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { themes } from "@/data/listings";
import { ImagePlus } from "lucide-react";

export const Route = createFileRoute("/sprzedaj")({
  head: () => ({
    meta: [
      { title: "Wystaw zestaw LEGO na sprzedaż — Klockownia" },
      {
        name: "description",
        content:
          "Dodaj ofertę w kilku krokach: zdjęcia, numer zestawu, stan i kompletność. Wystawienie jest darmowe.",
      },
      { property: "og:title", content: "Wystaw zestaw LEGO — Klockownia" },
      {
        property: "og:description",
        content: "Darmowe wystawienie oferty, prowizja tylko po sprzedaży.",
      },
    ],
  }),
  component: SellPage,
});

const conditions = ["Nowy w pudełku", "Bardzo dobry", "Dobry", "Używany"];

function SellPage() {
  const [sent, setSent] = useState(false);

  const field =
    "mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold">Wystaw ofertę</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Im dokładniej opiszesz stan i kompletność, tym szybciej znajdziesz kupca.
        </p>

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div className="card-surface flex flex-col items-center gap-2 border-dashed p-8 text-center">
            <ImagePlus className="size-6 text-brand" aria-hidden />
            <p className="text-sm font-medium">Dodaj zdjęcia zestawu</p>
            <p className="text-xs text-muted-foreground">
              Pokaż całość, instrukcję i ewentualne braki — do 8 zdjęć.
            </p>
          </div>

          <label className="block text-sm font-medium">
            Tytuł oferty
            <input required placeholder="np. Remiza strażacka, komplet" className={field} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Numer zestawu
              <input placeholder="60215" className={field} />
            </label>
            <label className="block text-sm font-medium">
              Seria
              <select className={field} defaultValue="City">
                {themes.slice(1).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Stan
              <select className={field} defaultValue="Bardzo dobry">
                {conditions.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Cena (zł)
              <input required type="number" min={1} placeholder="249" className={field} />
            </label>
          </div>

          <fieldset className="card-surface p-4">
            <legend className="px-1 text-sm font-medium">Co zawiera oferta</legend>
            <div className="mt-2 space-y-2">
              {["Wszystkie elementy", "Instrukcja", "Oryginalne pudełko"].map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-brand" />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-medium">
            Opis
            <textarea
              rows={5}
              placeholder="Historia zestawu, braki, stan naklejek, sposób pakowania…"
              className={field}
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
          >
            Opublikuj ofertę
          </button>

          {sent && (
            <p className="rounded-lg bg-brand-soft px-4 py-3 text-sm">
              Podgląd oferty gotowy. Publikacja na żywo pojawi się, gdy podłączymy konta
              użytkowników i płatności.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
