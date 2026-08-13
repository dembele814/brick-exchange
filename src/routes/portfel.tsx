import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CreditCard, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { topUpWallet, useAccount } from "@/data/account";

export const Route = createFileRoute("/portfel")({
  head: () => ({
    meta: [
      { title: "Portfel — Klockownia" },
      {
        name: "description",
        content:
          "Wpłacaj środki do portfela Klockowni i płać nimi za zestawy LEGO oraz wyróżnienia ogłoszeń.",
      },
      { property: "og:title", content: "Portfel — Klockownia" },
      { property: "og:description", content: "Saldo, wpłaty i historia operacji w jednym miejscu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

const quick = [50, 100, 200];

function WalletPage() {
  const { wallet } = useAccount();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Karta");

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Portfel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Płać z portfela jednym kliknięciem — bez wpisywania karty przy każdym zakupie.
        </p>

        <section className="mt-6 rounded-3xl border border-border bg-gradient-to-br from-grape-soft via-card to-sky-soft p-6">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="size-4" aria-hidden /> Dostępne środki
          </p>
          <p className="mt-1 font-display text-4xl font-bold">{wallet.balance.toFixed(2)} zł</p>
        </section>

        <section className="card-surface mt-6 space-y-4 p-5">
          <h2 className="text-lg font-semibold">Wpłać środki</h2>
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
              >
                {q} zł
              </button>
            ))}
          </div>
          <label className="block text-sm">
            Kwota (zł)
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="np. 150"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-2.5 outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>
          <label className="block text-sm">
            Metoda płatności
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-2.5 outline-none focus:ring-2 focus:ring-ring/40"
            >
              <option>Karta</option>
              <option>BLIK</option>
              <option>Przelew bankowy</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              topUpWallet(Number(amount));
              setAmount("");
            }}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
          >
            <CreditCard className="size-4" aria-hidden /> Wpłać
          </button>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Historia operacji</h2>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {wallet.transactions.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3.5 text-sm">
                <span
                  className={
                    t.amount > 0
                      ? "grid size-9 place-items-center rounded-full bg-mint-soft"
                      : "grid size-9 place-items-center rounded-full bg-brand-soft"
                  }
                >
                  {t.amount > 0 ? (
                    <ArrowDownLeft className="size-4" aria-hidden />
                  ) : (
                    <ArrowUpRight className="size-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.label}</span>
                  <span className="block text-xs text-muted-foreground">{t.at}</span>
                </span>
                <span className="font-semibold">
                  {t.amount > 0 ? "+" : "−"}
                  {Math.abs(t.amount).toFixed(2)} zł
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
