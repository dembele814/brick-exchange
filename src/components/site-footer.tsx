import { ShieldCheck, Sparkles, Truck } from "lucide-react";

const tiles = [
  {
    icon: ShieldCheck,
    t: "Ochrona kupującego",
    d: "Pieniądze trafiają do sprzedającego po odbiorze paczki.",
  },
  {
    icon: Sparkles,
    t: "Weryfikacja kompletności",
    d: "Każda oferta ma listę braków i stan instrukcji.",
  },
  { icon: Truck, t: "Wysyłka od 9 zł", d: "Paczkomaty i kurier w jednym kliknięciu." },
];

export function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-bold">Drugie życie każdego zestawu</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Kupuj kompletne zestawy, pojedyncze minifigurki i klocki na wagę — od
          kolekcjonerów, którzy dokładnie opisują stan każdego elementu.
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          {tiles.map(({ icon: Icon, t, d }) => (
            <div key={t} className="card-surface p-4">
              <Icon className="size-5 text-brand" aria-hidden />
              <dt className="mt-3 text-sm font-semibold">{t}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>© 2026 Klockownia — niezależny serwis społeczności budujących.</p>
          <p>Nie jesteśmy powiązani z producentem klocków.</p>
        </div>
      </div>
    </footer>
  );
}
