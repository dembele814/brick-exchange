import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleDollarSign, Clock3, PackageCheck, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AccountGate } from "@/components/account-gate";
import { useAccount } from "@/data/account";
import { useOrders } from "@/data/marketplace";

export const Route = createFileRoute("/portfel")({
  head: () => ({
    meta: [
      { title: "Sprzedaż i wypłaty — Klockownia" },
      {
        name: "description",
        content: "Rzeczywiste podsumowanie sprzedaży oraz stan uruchomienia wypłat w Klockowni.",
      },
      { property: "og:title", content: "Sprzedaż i wypłaty — Klockownia" },
      {
        property: "og:description",
        content: "Sprzedane zestawy, wartość zamówień i informacje o wypłatach.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });
const activeStatuses = new Set(["Opłacone", "Wysłane", "Dostarczone"]);

function WalletPage() {
  const { loggedIn } = useAccount();
  const { items: orders, loading, error } = useOrders();

  if (!loggedIn)
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <AccountGate feature="podsumowanie sprzedaży" />
        </main>
        <SiteFooter />
      </div>
    );

  const sold = orders.filter((order) => order.kind === "sold");
  const paid = sold.filter((order) => activeStatuses.has(order.status));
  const delivered = sold.filter((order) => order.status === "Dostarczone");
  const awaiting = sold.filter(
    (order) => order.status === "Opłacone" || order.status === "Wysłane",
  );
  const salesValue = paid.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Sprzedawanie</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Sprzedaż i wypłaty</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Dane poniżej pochodzą z Twoich zamówień. Kwota sprzedaży nie jest saldem do wypłaty.
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={CircleDollarSign}
            label="Wartość opłaconych ofert"
            value={loading ? "…" : money.format(salesValue)}
          />
          <SummaryCard
            icon={Clock3}
            label="W realizacji"
            value={loading ? "…" : String(awaiting.length)}
          />
          <SummaryCard
            icon={PackageCheck}
            label="Dostarczone"
            value={loading ? "…" : String(delivered.length)}
          />
        </section>

        {error && (
          <p className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <section className="mt-6 rounded-3xl border border-sky/25 bg-sky-soft/65 p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card text-sky shadow-card">
              <Wallet className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Wypłaty nie są jeszcze aktywne</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Obecnie działają wyłącznie płatności testowe Stripe. Przed przyjmowaniem prawdziwych
                pieniędzy uruchomimy weryfikację sprzedawców i wypłaty przez Stripe Connect.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Ostatnie sprzedane oferty</h2>
              <p className="mt-1 text-sm text-muted-foreground">Statusy pochodzą z prawdziwych zamówień.</p>
            </div>
            <Link to="/zamowienia" className="text-sm font-semibold text-brand hover:underline">
              Wszystkie zamówienia
            </Link>
          </div>

          {!loading && sold.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <p className="font-semibold">Nie masz jeszcze sprzedanych ofert</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Opłacone zamówienia pojawią się tutaj automatycznie.
              </p>
              <Link
                to="/sprzedaj"
                className="mt-4 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground"
              >
                Wystaw ofertę
              </Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {sold.slice(0, 5).map((order) => (
                <li key={order.id} className="flex items-center gap-3 px-4 py-3.5 text-sm">
                  <img
                    src={order.image}
                    alt=""
                    className="size-12 shrink-0 rounded-xl bg-secondary object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{order.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {order.status} · {order.at}
                    </span>
                  </span>
                  <span className="font-semibold">{money.format(order.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  return (
    <div className="card-surface p-5">
      <Icon className="size-5 text-brand" aria-hidden />
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
