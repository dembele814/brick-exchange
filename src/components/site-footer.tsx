import { Link } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, Truck } from "lucide-react";

const tiles = [
  {
    icon: ShieldCheck,
    t: "Bezpieczna wersja testowa",
    d: "Stripe obsługuje płatności i wypłaty testowe. Prawdziwe pieniądze pozostają wyłączone.",
  },
  {
    icon: Sparkles,
    t: "Weryfikacja kompletności",
    d: "Każda oferta ma listę braków i stan instrukcji.",
  },
  { icon: Truck, t: "Wysyłka do punktu", d: "Wybierz przewoźnika i podaj kod punktu odbioru." },
];

export function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-bold">Drugie życie każdego zestawu</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Kupuj kompletne zestawy, pojedyncze minifigurki i klocki na wagę — od kolekcjonerów,
          którzy dokładnie opisują stan każdego elementu.
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

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>© 2026 Klockogram — operator: Anna Wójcik, działalność nierejestrowana.</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Informacje prawne">
            <Link to="/regulamin" className="hover:text-foreground hover:underline">
              Regulamin
            </Link>
            <Link to="/polityka-prywatnosci" className="hover:text-foreground hover:underline">
              Polityka prywatności
            </Link>
          </nav>
          <p className="w-full text-xs">Nie jesteśmy powiązani z producentem klocków.</p>
        </div>
      </div>
    </footer>
  );
}
