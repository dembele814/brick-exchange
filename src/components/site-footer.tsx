import { Link } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, Truck } from "lucide-react";
import { usePublicStatus } from "@/data/public-status";
import { BrandLogo } from "@/components/brand-logo";

const tiles = [
  {
    icon: Sparkles,
    t: "Weryfikacja kompletności",
    d: "Każda oferta ma listę braków i stan instrukcji.",
  },
  {
    icon: Truck,
    t: "Wysyłka do punktu",
    d: "Wyszukaj punkt po adresie lub znajdź najbliższy dzięki lokalizacji.",
  },
];

export function SiteFooter() {
  const { data: publicStatus } = usePublicStatus();
  const paymentTile =
    publicStatus?.stripeMode === "test"
      ? {
          icon: ShieldCheck,
          t: "Bezpieczna wersja testowa",
          d: "Stripe obsługuje płatności testowe. Prawdziwe pieniądze pozostają wyłączone.",
        }
      : publicStatus?.stripeMode === "unconfigured"
        ? {
            icon: ShieldCheck,
            t: "Płatności chwilowo niedostępne",
            d: "Możesz przeglądać oferty. Zakup będzie możliwy po przywróceniu płatności.",
          }
        : {
            icon: ShieldCheck,
            t: "Bezpieczne płatności",
            d: "Płatności kupujących oraz wypłaty sprzedających obsługuje Stripe.",
          };

  return (
    <footer className="relative mt-16 overflow-hidden border-t border-border bg-surface">
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <BrandLogo />
        <h2 className="mt-6 max-w-xl text-2xl font-bold sm:text-3xl">
          Drugie życie zaczyna się od jednego klocka.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Kupuj kompletne zestawy, pojedyncze minifigurki i klocki na wagę — od kolekcjonerów,
          którzy dokładnie opisują stan każdego elementu.
        </p>

        <dl className="mt-9 grid gap-4 sm:grid-cols-3">
          {[paymentTile, ...tiles].map(({ icon: Icon, t, d }) => (
            <div key={t} className="card-surface group p-5 transition-colors hover:border-brand/40">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft">
                <Icon className="size-5 text-brand" aria-hidden />
              </span>
              <dt className="mt-3 text-sm font-semibold">{t}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>© 2026 Klockogram — operator: Paweł Wójcik, działalność nierejestrowana.</p>
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
