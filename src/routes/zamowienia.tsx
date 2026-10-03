import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAccount } from "@/data/account";

export const Route = createFileRoute("/zamowienia")({
  head: () => ({
    meta: [
      { title: "Moje zamówienia — Klockownia" },
      {
        name: "description",
        content: "Podgląd zestawów LEGO, które kupiłeś i sprzedałeś, wraz ze statusem wysyłki.",
      },
      { property: "og:title", content: "Moje zamówienia — Klockownia" },
      { property: "og:description", content: "Kupione i sprzedane zestawy w jednym widoku." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

const tabs = [
  { key: "bought", label: "Kupione" },
  { key: "sold", label: "Sprzedane" },
] as const;

function OrdersPage() {
  const { orders } = useAccount();
  const [tab, setTab] = useState<"bought" | "sold">("bought");
  const shown = orders.filter((o) => o.kind === tab);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Moje zamówienia</h1>

        <div className="mt-5 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={
                tab === t.key
                  ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  : "rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {t.label} ({orders.filter((o) => o.kind === t.key).length})
            </button>
          ))}
        </div>

        <ul className="mt-5 space-y-3">
          {shown.map((o) => (
            <li key={o.id} className="card-surface flex items-center gap-4 p-3">
              <img
                src={o.image}
                alt={o.title}
                width={96}
                height={96}
                loading="lazy"
                className="size-20 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-semibold">{o.title}</p>
                <p className="text-muted-foreground">
                  {tab === "bought" ? "Sprzedawca" : "Kupujący"}: {o.counterparty} · {o.at}
                </p>
                <p className="mt-1.5 inline-flex rounded-full bg-sky-soft px-2.5 py-1 text-xs font-semibold">
                  {o.status}
                </p>
              </div>
              <p className="shrink-0 text-right text-sm font-bold">
                {(tab === "bought" ? o.total : o.price).toFixed(2)} zł
              </p>
            </li>
          ))}
        </ul>

        {shown.length === 0 && (
          <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Brak zamówień w tej zakładce.
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
