import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { authenticatedRequest } from "@/lib/authenticated-request";
import { requireSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Panel administratora — Klockogram" }] }),
  component: AdminPage,
});

type AdminProblem = {
  id: number;
  order_id: string;
  payload?: { details?: string } | null;
};
type AdminReport = {
  id: string;
  reason: string;
  details?: string | null;
  listings: { title: string; status: string } | { title: string; status: string }[] | null;
};
type AdminData = {
  problems: AdminProblem[];
  reports: AdminReport[];
  stripeMode: "test" | "live" | "unconfigured";
  emailMode: "test" | "live" | "unconfigured";
  shippingMode: "stage" | "live" | "unconfigured";
  appOrigin: string | null;
};

const modeLabel = {
  live: "Produkcyjne",
  test: "Testowe",
  stage: "Testowe",
  unconfigured: "Brak konfiguracji",
} as const;

function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await authenticatedRequest(requireSupabase(), "/api/admin", { method: "GET" });
    const result = (await response.json()) as AdminData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Nie udało się otworzyć panelu.");
    setData(result);
  }, []);
  useEffect(() => {
    void load().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Brak dostępu."),
    );
  }, [load]);
  const action = async (body: Record<string, string>) => {
    setWorking(Object.values(body).join(":"));
    setError(null);
    setNotice(null);
    try {
      const response = await authenticatedRequest(requireSupabase(), "/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        error?: string;
        summary?: {
          pendingPaymentsChecked: number;
          refundsCompleted: number;
          transfersCompleted: number;
          failures: number;
        };
      };
      if (!response.ok) throw new Error(result.error ?? "Operacja nie powiodła się.");
      if (result.summary)
        setNotice(
          `Sprawdzono płatności: ${result.summary.pendingPaymentsChecked}, zwroty: ${result.summary.refundsCompleted}, wypłaty: ${result.summary.transfersCompleted}, błędy: ${result.summary.failures}.`,
        );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operacja nie powiodła się.");
    } finally {
      setWorking(null);
    }
  };
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold">Panel administratora</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Zgłoszenia zamówień, moderacja ofert i zwroty płatności.
        </p>
        <button
          type="button"
          disabled={Boolean(working)}
          onClick={() => void action({ action: "reconcile_money" })}
          className="mt-4 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
        >
          {working === "reconcile_money" ? "Sprawdzanie…" : "Sprawdź płatności i wypłaty"}
        </button>
        {notice && <p className="mt-4 rounded-xl bg-mint-soft p-4 text-sm">{notice}</p>}
        {error && (
          <p className="mt-5 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>
        )}
        {!data && !error && <p className="mt-6 text-sm">Wczytujemy panel…</p>}
        {data && (
          <>
            <section className="mt-6 card-surface p-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">Gotowość produkcyjna</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Najważniejsze usługi potrzebne do uruchomienia sprzedaży.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Bez ujawniania kluczy i haseł</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Płatności Stripe", modeLabel[data.stripeMode], data.stripeMode === "live"],
                  ["E-maile", modeLabel[data.emailMode], data.emailMode === "live"],
                  ["Przesyłki InPost", modeLabel[data.shippingMode], data.shippingMode === "live"],
                  [
                    "Adres aplikacji",
                    data.appOrigin ?? "Brak konfiguracji",
                    Boolean(data.appOrigin?.startsWith("https://")),
                  ],
                ].map(([name, value, ready]) => (
                  <div
                    key={String(name)}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {name}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`}
                      />
                      <p className="break-all text-sm font-semibold">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="text-lg font-bold">
                  Problemy z zamówieniami ({data.problems.length})
                </h2>
                <ul className="mt-3 space-y-3">
                  {data.problems.map((problem) => (
                    <li key={problem.id} className="card-surface p-4 text-sm">
                      <p className="font-semibold">Zamówienie {problem.order_id.slice(0, 8)}</p>
                      <p className="mt-1 text-muted-foreground">
                        {problem.payload?.details ?? "Brak opisu"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          disabled={Boolean(working)}
                          onClick={() =>
                            void action({ action: "close_problem", orderId: problem.order_id })
                          }
                          className="rounded-full border border-border px-3 py-2 text-xs font-semibold"
                        >
                          Zamknij zgłoszenie
                        </button>
                        <button
                          disabled={Boolean(working)}
                          onClick={() =>
                            window.confirm(
                              data.stripeMode === "live"
                                ? "To jest prawdziwa płatność. Cofnąć transfer i zwrócić kupującemu pełną kwotę?"
                                : "Cofnąć transfer i zwrócić pełną płatność testową?",
                            ) && void action({ action: "refund_order", orderId: problem.order_id })
                          }
                          className="rounded-full bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground"
                        >
                          {data.stripeMode === "live" ? "Pełny zwrot" : "Pełny zwrot testowy"}
                        </button>
                      </div>
                    </li>
                  ))}
                  {!data.problems.length && (
                    <li className="text-sm text-muted-foreground">Brak otwartych problemów.</li>
                  )}
                </ul>
              </section>
              <section>
                <h2 className="text-lg font-bold">Zgłoszone oferty ({data.reports.length})</h2>
                <ul className="mt-3 space-y-3">
                  {data.reports.map((report) => {
                    const listing = Array.isArray(report.listings)
                      ? report.listings[0]
                      : report.listings;
                    return (
                      <li key={report.id} className="card-surface p-4 text-sm">
                        <p className="font-semibold">{listing?.title ?? "Usunięta oferta"}</p>
                        <p className="mt-1 text-muted-foreground">
                          {report.reason}: {report.details || "brak szczegółów"}
                        </p>
                        <button
                          disabled={Boolean(working) || listing?.status === "hidden"}
                          onClick={() =>
                            void action({ action: "hide_listing", reportId: report.id })
                          }
                          className="mt-3 rounded-full border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          {listing?.status === "hidden" ? "Oferta ukryta" : "Ukryj ofertę"}
                        </button>
                      </li>
                    );
                  })}
                  {!data.reports.length && (
                    <li className="text-sm text-muted-foreground">Brak zgłoszonych ofert.</li>
                  )}
                </ul>
              </section>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
