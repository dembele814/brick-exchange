import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CircleDollarSign, Clock3, PackageCheck, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AccountGate } from "@/components/account-gate";
import { useAccount } from "@/data/account";
import { useOrders } from "@/data/marketplace";
import { authenticatedRequest } from "@/lib/authenticated-request";
import { requireSupabase } from "@/lib/supabase";

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
  const [connectStatus, setConnectStatus] = useState<
    "loading" | "missing" | "pending" | "active" | "restricted" | "error"
  >("loading");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    void authenticatedRequest(requireSupabase(), "/api/connect", { method: "GET" })
      .then(async (response) => {
        const result = (await response.json()) as { state?: typeof connectStatus; error?: string };
        if (!response.ok || !result.state) throw new Error(result.error ?? "Brak statusu Stripe.");
        setConnectStatus(result.state);
      })
      .catch(() => setConnectStatus("error"));
  }, [loggedIn]);

  const startConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const response = await authenticatedRequest(requireSupabase(), "/api/connect", {
        method: "POST",
      });
      const result = (await response.json()) as { onboardingUrl?: string; error?: string };
      if (!response.ok || !result.onboardingUrl)
        throw new Error(result.error ?? "Nie udało się otworzyć Stripe.");
      setOnboardingUrl(result.onboardingUrl);
      setConnecting(false);
    } catch (cause) {
      setConnectError(cause instanceof Error ? cause.message : "Nie udało się otworzyć Stripe.");
      setConnecting(false);
    }
  };

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
          Dane poniżej pochodzą z Twoich zamówień. Planowana prowizja Klockowni wynosi 1 zł + 5%
          ceny oferty. Kwota sprzedaży nie jest saldem do wypłaty.
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
              <h2 className="text-lg font-semibold">
                {connectStatus === "active"
                  ? "Konto testowe Stripe jest gotowe"
                  : "Skonfiguruj testowe konto wypłat"}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {connectStatus === "active"
                  ? "Stripe potwierdził możliwość otrzymywania transferów w sandboxie. Prawdziwe pieniądze pozostają wyłączone."
                  : "Stripe Connect przeprowadzi testową weryfikację sprzedawcy. W sandboxie używaj wyłącznie danych testowych."}
              </p>
              {connectStatus !== "active" && connectStatus !== "loading" && !onboardingUrl && (
                <button
                  type="button"
                  disabled={connecting}
                  onClick={() => void startConnect()}
                  className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
                >
                  {connecting
                    ? "Otwieramy Stripe…"
                    : connectStatus === "missing"
                      ? "Rozpocznij testową weryfikację"
                      : "Dokończ testową weryfikację"}
                </button>
              )}
              {onboardingUrl && (
                <div className="mt-4 rounded-2xl border border-sky/25 bg-card p-4">
                  <p className="text-sm font-semibold">Link Stripe jest gotowy</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Otwórz go jako zwykłą kartę przeglądarki. Link jest jednorazowy.
                  </p>
                  <a
                    href={onboardingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
                  >
                    Otwórz Stripe w nowej karcie
                  </a>
                </div>
              )}
              {connectStatus === "loading" && (
                <p className="mt-3 text-xs font-semibold text-muted-foreground">
                  Sprawdzamy Stripe…
                </p>
              )}
              {connectError && <p className="mt-3 text-sm text-destructive">{connectError}</p>}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Ostatnie sprzedane oferty</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Statusy pochodzą z prawdziwych zamówień.
              </p>
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
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
