import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CircleDollarSign, Clock3, PackageCheck, ShoppingBag, Wallet } from "lucide-react";
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
      { title: "Zakupy, sprzedaż i wypłaty — Klockownia" },
      {
        name: "description",
        content: "Podsumowanie zakupów, sprzedaży oraz stan wypłat w Klockowni.",
      },
      { property: "og:title", content: "Zakupy, sprzedaż i wypłaty — Klockownia" },
      {
        property: "og:description",
        content: "Kupione i sprzedane zestawy, wartości zamówień oraz informacje o wypłatach.",
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
  const [payouts, setPayouts] = useState<
    Record<string, { state: "loading" | "done" | "error"; message?: string }>
  >({});

  useEffect(() => {
    if (!loggedIn) return;
    void authenticatedRequest(requireSupabase(), "/api/connect", { method: "GET" })
      .then(async (response) => {
        const result = (await response.json()) as {
          state?: typeof connectStatus;
          transfers?: Record<string, { amount: number; fee: number }>;
          error?: string;
        };
        if (!response.ok || !result.state) throw new Error(result.error ?? "Brak statusu Stripe.");
        setConnectStatus(result.state);
        if (result.transfers)
          setPayouts(
            Object.fromEntries(
              Object.entries(result.transfers).map(([orderId, transfer]) => [
                orderId,
                {
                  state: "done" as const,
                  message: `Przekazano testowo ${money.format(transfer.amount / 100)}`,
                },
              ]),
            ),
          );
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

  const requestTestTransfer = async (orderId: string) => {
    setPayouts((current) => ({ ...current, [orderId]: { state: "loading" } }));
    try {
      const response = await authenticatedRequest(requireSupabase(), "/api/connect", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const result = (await response.json()) as {
        state?: "transferred" | "no_transfer";
        amount?: number;
        error?: string;
      };
      if (!response.ok || !result.state)
        throw new Error(result.error ?? "Nie udało się wykonać transferu.");
      setPayouts((current) => ({
        ...current,
        [orderId]: {
          state: "done",
          message:
            result.state === "transferred"
              ? `Przekazano testowo ${money.format((result.amount ?? 0) / 100)}`
              : "Cała kwota pokrywa prowizję",
        },
      }));
    } catch (cause) {
      setPayouts((current) => ({
        ...current,
        [orderId]: {
          state: "error",
          message: cause instanceof Error ? cause.message : "Nie udało się wykonać transferu.",
        },
      }));
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
  const bought = orders.filter((order) => order.kind === "bought");
  const paid = sold.filter((order) => activeStatuses.has(order.status));
  const paidPurchases = bought.filter((order) => activeStatuses.has(order.status));
  const delivered = sold.filter((order) => order.status === "Dostarczone");
  const awaiting = sold.filter(
    (order) => order.status === "Opłacone" || order.status === "Wysłane",
  );
  const salesValue = paid.reduce((sum, order) => sum + order.total, 0);
  const purchasesValue = paidPurchases.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Twoje transakcje</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Zakupy, sprzedaż i wypłaty</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Zakupy i sprzedaże są pokazane obok siebie. Prowizja Klockowni wynosi 1 zł + 5% ceny
          oferty. Wypłata dla sprzedającego jest dostępna po potwierdzeniu odbioru.
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={ShoppingBag}
            label="Wartość zakupów"
            value={loading ? "…" : money.format(purchasesValue)}
          />
          <SummaryCard
            icon={CircleDollarSign}
            label="Wartość sprzedaży"
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
              <h2 className="text-lg font-semibold">Zakupy i sprzedaże</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ostatnie transakcje i ich statusy.
              </p>
            </div>
            <Link to="/zamowienia" className="text-sm font-semibold text-brand hover:underline">
              Zobacz wszystkie
            </Link>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
                <ShoppingBag className="size-4 text-brand" aria-hidden /> Zakupy ({bought.length})
              </h3>
              {!loading && bought.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  Nie masz jeszcze zakupów.
                </div>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {bought.slice(0, 5).map((order) => (
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
                      <span className="shrink-0 font-semibold">{money.format(order.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
                <CircleDollarSign className="size-4 text-brand" aria-hidden /> Sprzedaże (
                {sold.length})
              </h3>
              {!loading && sold.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
                  <p className="text-sm text-muted-foreground">Nie masz jeszcze sprzedaży.</p>
                  <Link
                    to="/sprzedaj"
                    className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline"
                  >
                    Wystaw ofertę
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
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
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold">{money.format(order.total)}</span>
                        {order.status === "Dostarczone" && connectStatus === "active" && (
                          <button
                            type="button"
                            disabled={payouts[order.id]?.state === "loading"}
                            onClick={() => void requestTestTransfer(order.id)}
                            className="mt-1 text-xs font-semibold text-brand hover:underline disabled:opacity-60"
                          >
                            {payouts[order.id]?.state === "loading"
                              ? "Przekazujemy…"
                              : payouts[order.id]?.state === "done"
                                ? payouts[order.id]?.message
                                : "Wykonaj transfer testowy"}
                          </button>
                        )}
                        {payouts[order.id]?.state === "error" && (
                          <span className="mt-1 block max-w-52 text-xs text-destructive">
                            {payouts[order.id]?.message}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
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
