import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Check, Copy, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AccountGate } from "@/components/account-gate";
import { useAccount } from "@/data/account";
import {
  cancelOrderBeforeShipment,
  confirmOrderDelivered,
  markOrderShipped,
  submitReview,
  updateOrderProblem,
  useOrderEvents,
  useOrders,
} from "@/data/marketplace";

export const Route = createFileRoute("/zamowienia")({
  validateSearch: z.object({
    order: z.string().uuid().optional(),
    payment: z.enum(["success", "cancelled"]).optional(),
  }),
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

const carrierTrackingPages = {
  inpost: { href: "https://inpost.pl/sledzenie-przesylek", label: "Śledź w InPost" },
  orlen: { href: "https://www.orlenpaczka.pl/aplikacja/", label: "Śledź w aplikacji ORLEN" },
  dpd: { href: "https://tracktrace.dpd.com.pl/", label: "Śledź w DPD" },
  dhl: { href: "https://www.dhl.com/pl-pl/home/tracking.html", label: "Śledź w DHL" },
} as const;

function OrdersPage() {
  const { loggedIn } = useAccount();
  const { items: orders, loading, error, reload } = useOrders();
  const { order: focusedOrderId, payment } = Route.useSearch();
  const {
    items: events,
    error: eventsError,
    reload: reloadEvents,
  } = useOrderEvents(orders.map((order) => order.id));
  const [tab, setTab] = useState<"bought" | "sold">("bought");
  const [fulfillmentError, setFulfillmentError] = useState<string | null>(null);
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [deliveryOrderId, setDeliveryOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [problemOrderId, setProblemOrderId] = useState<string | null>(null);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<string[]>([]);
  const [timelineOrderId, setTimelineOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const shown = orders.filter((o) => o.kind === tab);
  const focusedOrder = focusedOrderId
    ? orders.find((order) => order.id === focusedOrderId)
    : undefined;

  useEffect(() => {
    if (!focusedOrderId) return;
    const focused = orders.find((order) => order.id === focusedOrderId);
    if (focused) setTab(focused.kind);
  }, [focusedOrderId, orders]);

  useEffect(() => {
    if (!focusedOrderId) return;
    const timer = window.setTimeout(
      () =>
        document
          .getElementById(`order-${focusedOrderId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      100,
    );
    return () => window.clearTimeout(timer);
  }, [focusedOrderId, tab]);

  if (!loggedIn)
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <AccountGate feature="swoje zamówienia" />
        </main>
        <SiteFooter />
      </div>
    );

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
                  ? "rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
                  : "rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {t.label} ({orders.filter((o) => o.kind === t.key).length})
            </button>
          ))}
        </div>

        <ul className="mt-5 space-y-3">
          {shown.map((o) => (
            <li
              id={`order-${o.id}`}
              key={o.id}
              className={
                focusedOrderId === o.id
                  ? "card-surface flex items-center gap-4 border-brand/45 bg-brand-soft/30 p-3 shadow-lift"
                  : "card-surface flex items-center gap-4 p-3"
              }
            >
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
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Odbiór: {o.carrier}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Punkt odbioru:{" "}
                  <span className="font-semibold text-foreground">{o.pickupPoint}</span>
                </p>
                {o.trackingNumber && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-brand">
                      Numer śledzenia: {o.trackingNumber}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(o.trackingNumber!)
                          .then(() => {
                            setCopied(o.id);
                            window.setTimeout(
                              () => setCopied((id) => (id === o.id ? null : id)),
                              1800,
                            );
                          })
                          .catch(() =>
                            setFulfillmentError("Nie udało się skopiować numeru śledzenia."),
                          );
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                    >
                      {copied === o.id ? (
                        <Check className="size-3 text-mint" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {copied === o.id ? "Skopiowano" : "Kopiuj"}
                    </button>
                  </div>
                )}
                {o.trackingNumber && (
                  <a
                    href={carrierTrackingPages[o.carrierCode].href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand/75"
                  >
                    {carrierTrackingPages[o.carrierCode].label}
                    <ExternalLink className="size-3" />
                  </a>
                )}
                {focusedOrderId === o.id && (
                  <p className="mt-2 rounded-lg bg-brand-soft px-2.5 py-2 text-xs font-semibold text-foreground">
                    {tab === "sold" && o.status === "Opłacone"
                      ? "To zamówienie jest opłacone — dodaj numer śledzenia po nadaniu."
                      : tab === "bought" && o.status === "Wysłane"
                        ? "Przesyłka została nadana — potwierdź odbiór, gdy ją otrzymasz."
                        : "Otworzyliśmy zamówienie z Twojego powiadomienia."}
                  </p>
                )}
                {tab === "sold" && o.status === "Opłacone" && (
                  <form
                    className="mt-3 flex flex-wrap gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const trackingNumber = String(
                        new FormData(event.currentTarget).get("trackingNumber") ?? "",
                      ).trim();
                      if (!trackingNumber) return;
                      setShippingOrderId(o.id);
                      setFulfillmentError(null);
                      void markOrderShipped(o.id, trackingNumber)
                        .then(reload)
                        .catch((cause) =>
                          setFulfillmentError(
                            cause instanceof Error
                              ? cause.message
                              : "Nie udało się nadać przesyłki.",
                          ),
                        )
                        .finally(() => setShippingOrderId(null));
                    }}
                  >
                    <input
                      name="trackingNumber"
                      required
                      minLength={3}
                      placeholder="Numer śledzenia"
                      className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                    />
                    <button
                      disabled={shippingOrderId === o.id}
                      className="rounded-full bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground disabled:opacity-60"
                    >
                      {shippingOrderId === o.id ? "Zapis…" : "Oznacz jako wysłane"}
                    </button>
                  </form>
                )}
                {tab === "bought" &&
                  o.status === "Wysłane" &&
                  !events
                    .filter((event) => event.orderId === o.id)
                    .some(
                      (event, index, orderEvents) =>
                        event.type === "problem_reported" &&
                        !orderEvents
                          .slice(index + 1)
                          .some((later) => later.type === "problem_resolved"),
                    ) && (
                    <button
                      type="button"
                      disabled={deliveryOrderId === o.id}
                      onClick={() => {
                        setDeliveryOrderId(o.id);
                        setFulfillmentError(null);
                        void confirmOrderDelivered(o.id)
                          .then(reload)
                          .catch((cause) =>
                            setFulfillmentError(
                              cause instanceof Error
                                ? cause.message
                                : "Nie udało się potwierdzić odbioru.",
                            ),
                          )
                          .finally(() => setDeliveryOrderId(null));
                      }}
                      className="mt-3 rounded-full bg-mint px-3 py-2 text-xs font-semibold text-primary disabled:opacity-60"
                    >
                      {deliveryOrderId === o.id ? "Zapis…" : "Potwierdź odbiór paczki"}
                    </button>
                  )}
                {tab === "bought" && o.status === "Wysłane" && (
                  <div className="mt-3">
                    {events.filter((event) => event.orderId === o.id).at(-1)?.type ===
                    "problem_reported" ? (
                      <div className="rounded-xl border border-sun/40 bg-sun-soft p-3">
                        <p className="text-xs font-semibold">Problem zgłoszony — wypłata czeka.</p>
                        <button
                          type="button"
                          disabled={problemOrderId === o.id}
                          onClick={() => {
                            setProblemOrderId(o.id);
                            setFulfillmentError(null);
                            void updateOrderProblem(o.id, { action: "resolve_problem" })
                              .then(() => {
                                reload();
                                reloadEvents();
                              })
                              .catch((cause) =>
                                setFulfillmentError(
                                  cause instanceof Error
                                    ? cause.message
                                    : "Nie udało się zamknąć zgłoszenia.",
                                ),
                              )
                              .finally(() => setProblemOrderId(null));
                          }}
                          className="mt-2 text-xs font-semibold text-brand hover:text-brand/75 disabled:opacity-60"
                        >
                          Problem rozwiązany
                        </button>
                      </div>
                    ) : (
                      <form
                        className="rounded-xl border border-border bg-card p-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          setProblemOrderId(o.id);
                          setFulfillmentError(null);
                          void updateOrderProblem(o.id, {
                            action: "report_problem",
                            reason: String(form.get("reason")) as
                              | "damaged"
                              | "incomplete"
                              | "not_as_described"
                              | "not_received"
                              | "other",
                            details: String(form.get("details") ?? ""),
                          })
                            .then(() => {
                              reload();
                              reloadEvents();
                            })
                            .catch((cause) =>
                              setFulfillmentError(
                                cause instanceof Error
                                  ? cause.message
                                  : "Nie udało się zgłosić problemu.",
                              ),
                            )
                            .finally(() => setProblemOrderId(null));
                        }}
                      >
                        <p className="text-xs font-semibold">Problem z paczką?</p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <select
                            name="reason"
                            className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
                          >
                            <option value="damaged">Uszkodzona</option>
                            <option value="incomplete">Brakuje elementów</option>
                            <option value="not_as_described">Niezgodna z opisem</option>
                            <option value="not_received">Nie dotarła</option>
                            <option value="other">Inny problem</option>
                          </select>
                          <input
                            name="details"
                            required
                            minLength={10}
                            maxLength={1000}
                            placeholder="Opisz problem (min. 10 znaków)"
                            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                          />
                          <button
                            disabled={problemOrderId === o.id}
                            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-60"
                          >
                            Zgłoś
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
                {tab === "bought" && (o.status === "Opłacone" || o.status === "Zwrot w toku") && (
                  <button
                    type="button"
                    disabled={cancellingOrderId === o.id}
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Anulować zamówienie i zwrócić całą płatność testową? Oferta ponownie trafi do sprzedaży.",
                        )
                      )
                        return;
                      setCancellingOrderId(o.id);
                      setFulfillmentError(null);
                      void cancelOrderBeforeShipment(o.id)
                        .then(reload)
                        .catch((cause) =>
                          setFulfillmentError(
                            cause instanceof Error
                              ? cause.message
                              : "Nie udało się anulować zamówienia.",
                          ),
                        )
                        .finally(() => setCancellingOrderId(null));
                    }}
                    className="mt-3 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                  >
                    {cancellingOrderId === o.id
                      ? "Zwracanie płatności…"
                      : o.status === "Zwrot w toku"
                        ? "Sprawdź zwrot ponownie"
                        : "Anuluj i zwróć płatność testową"}
                  </button>
                )}
                {tab === "bought" &&
                  o.status === "Dostarczone" &&
                  !reviewedOrderIds.includes(o.id) && (
                    <form
                      className="mt-3 rounded-xl bg-secondary/70 p-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        const rating = Number(form.get("rating"));
                        const body = String(form.get("review") ?? "");
                        setFulfillmentError(null);
                        void submitReview(o.id, rating, body)
                          .then(() => setReviewedOrderIds((ids) => [...ids, o.id]))
                          .catch((cause) =>
                            setFulfillmentError(
                              cause instanceof Error
                                ? cause.message
                                : "Nie udało się zapisać opinii.",
                            ),
                          );
                      }}
                    >
                      <p className="text-xs font-semibold">Jak oceniasz zakup?</p>
                      <div className="mt-2 flex gap-2">
                        <select
                          name="rating"
                          defaultValue="5"
                          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs"
                        >
                          <option value="5">★★★★★ 5</option>
                          <option value="4">★★★★☆ 4</option>
                          <option value="3">★★★☆☆ 3</option>
                          <option value="2">★★☆☆☆ 2</option>
                          <option value="1">★☆☆☆☆ 1</option>
                        </select>
                        <button className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                          Dodaj opinię
                        </button>
                      </div>
                      <input
                        name="review"
                        maxLength={500}
                        placeholder="Krótki komentarz (opcjonalnie)"
                        className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none"
                      />
                    </form>
                  )}
                {reviewedOrderIds.includes(o.id) && (
                  <p className="mt-2 text-xs font-semibold text-mint">Dziękujemy za opinię.</p>
                )}
                <button
                  type="button"
                  onClick={() => setTimelineOrderId((id) => (id === o.id ? null : o.id))}
                  className="mt-3 text-xs font-semibold text-brand hover:text-brand/75"
                >
                  {timelineOrderId === o.id ? "Ukryj historię" : "Zobacz historię zamówienia"}
                </button>
                {timelineOrderId === o.id && (
                  <ol className="mt-2 space-y-2 border-l-2 border-brand/25 pl-3">
                    {events
                      .filter((event) => event.orderId === o.id)
                      .map((event) => (
                        <li key={event.id} className="relative text-xs text-muted-foreground">
                          <span className="absolute -left-[17px] top-1 size-2.5 rounded-full bg-brand ring-4 ring-card" />
                          <span className="font-semibold text-foreground">{event.label}</span>
                          <span className="ml-1.5">{event.at}</span>
                        </li>
                      ))}
                    {events.filter((event) => event.orderId === o.id).length === 0 && (
                      <li className="text-xs text-muted-foreground">
                        Historia pojawi się po pierwszej zmianie statusu.
                      </li>
                    )}
                  </ol>
                )}
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

        {loading && (
          <p className="mt-6 text-sm text-muted-foreground">Wczytujemy Twoje zamówienia…</p>
        )}
        {payment === "success" && (
          <p className="mt-4 rounded-xl border border-mint/30 bg-mint-soft px-4 py-3 text-sm font-medium">
            {focusedOrder?.status === "Opłacone"
              ? "Testowa płatność została potwierdzona, a zamówienie ma status opłaconego."
              : "Testowa płatność oczekuje na potwierdzenie przez Stripe."}
          </p>
        )}
        {payment === "cancelled" && (
          <p className="mt-4 rounded-xl border border-sun/30 bg-sun-soft px-4 py-3 text-sm font-medium">
            Płatność została anulowana — oferta pozostaje dostępna, dopóki ktoś jej nie kupi.
          </p>
        )}
        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
        {eventsError && <p className="mt-3 text-sm text-destructive">{eventsError}</p>}
        {fulfillmentError && <p className="mt-3 text-sm text-destructive">{fulfillmentError}</p>}

        {!loading && !error && shown.length === 0 && (
          <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Brak zamówień w tej zakładce.
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
