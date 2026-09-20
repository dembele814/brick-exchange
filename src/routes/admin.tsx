import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  ClipboardList,
  LayoutDashboard,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { authenticatedRequest } from "@/lib/authenticated-request";
import { requireSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Panel administratora — Klockogram" }] }),
  component: AdminPage,
});

type AdminProblem = { id: number; order_id: string; payload?: { details?: string } | null };
type AdminReport = {
  id: string;
  reason: string;
  details?: string | null;
  listings:
    | { id: string; title: string; status: string }
    | { id: string; title: string; status: string }[]
    | null;
};
type AdminUser = {
  id: string;
  username: string;
  email: string;
  country: string;
  city: string | null;
  created_at: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  profile_visible: boolean;
  vacation_mode: boolean;
  listingCount: number;
  orderCount: number;
  moderation: {
    status: "active" | "suspended" | "permanent";
    suspended_until: string | null;
    reason: string | null;
  };
};
type AdminListing = {
  id: string;
  title: string;
  status: string;
  price_grosz: number;
  created_at: string;
  profiles: { username: string } | { username: string }[] | null;
};
type AdminOrder = {
  id: string;
  status: string;
  payment_status: string;
  amount_grosz: number;
  created_at: string;
  buyer: { username: string } | { username: string }[] | null;
  seller: { username: string } | { username: string }[] | null;
};
type AuditEntry = {
  id: number;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
};
type AdminData = {
  problems: AdminProblem[];
  reports: AdminReport[];
  users: AdminUser[];
  listings: AdminListing[];
  orders: AdminOrder[];
  audit: AuditEntry[];
  stats: {
    users: number;
    listings: number;
    activeListings: number;
    orders: number;
    openReports: number;
  };
  stripeMode: "test" | "live" | "unconfigured";
  emailMode: "test" | "live" | "unconfigured";
  shippingMode: "stage" | "live" | "unconfigured";
  shippingProvider: "furgonetka" | "shipx" | null;
  appOrigin: string | null;
};

const tabs = [
  ["pulpit", "Pulpit", LayoutDashboard],
  ["uzytkownicy", "Użytkownicy", Users],
  ["oferty", "Oferty", ShoppingBag],
  ["zgloszenia", "Zgłoszenia", AlertTriangle],
  ["zamowienia", "Zamówienia", Package],
  ["dziennik", "Dziennik", ClipboardList],
] as const;
type Tab = (typeof tabs)[number][0];

const modeLabel = {
  live: "Produkcyjne",
  test: "Testowe",
  stage: "Testowe",
  unconfigured: "Brak konfiguracji",
} as const;

const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";

function StatusBadge({ status }: { status: string }) {
  const active = ["active", "paid", "delivered", "live"].includes(status);
  const danger = ["permanent", "cancelled", "refunded", "hidden"].includes(status);
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        active && "bg-mint-soft text-mint",
        danger && "bg-destructive/10 text-destructive",
        !active && !danger && "bg-secondary text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<Tab>("pulpit");
  const [query, setQuery] = useState("");
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

  const action = async (body: Record<string, unknown>, success = "Zmiana została zapisana.") => {
    setWorking(String(body["action"] ?? "action"));
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
      setNotice(
        result.summary
          ? `Płatności: ${result.summary.pendingPaymentsChecked}, zwroty: ${result.summary.refundsCompleted}, wypłaty: ${result.summary.transfersCompleted}, błędy: ${result.summary.failures}.`
          : success,
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operacja nie powiodła się.");
    } finally {
      setWorking(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("pl");
    return (
      data?.users.filter((user) =>
        `${user.username} ${user.email} ${user.city ?? ""}`.toLocaleLowerCase("pl").includes(value),
      ) ?? []
    );
  }, [data, query]);

  const banUser = (user: AdminUser, duration: "24h" | "7d" | "30d" | "permanent") => {
    const reason = window.prompt(`Powód blokady konta @${user.username}:`);
    if (!reason) return;
    void action(
      { action: "ban_user", userId: user.id, duration, reason },
      "Konto zostało zablokowane.",
    );
  };

  const deleteUser = (user: AdminUser) => {
    const confirmation = window.prompt(
      `To trwale usunie konto bez historii transakcji. Wpisz dokładnie ${user.username}, aby potwierdzić:`,
    );
    if (!confirmation) return;
    void action(
      { action: "delete_user", userId: user.id, confirmation },
      "Konto zostało usunięte.",
    );
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-brand">
              <ShieldCheck className="size-5" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Tylko administrator
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Centrum zarządzania</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Użytkownicy, moderacja, sprzedaż i stan usług w jednym miejscu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold"
          >
            <RefreshCw className="size-4" /> Odśwież
          </button>
        </div>

        <nav
          className="-mx-3 mt-5 flex gap-1 overflow-x-auto border-y border-border px-3 py-2 sm:mx-0 sm:rounded-xl sm:border sm:bg-card sm:p-1"
          aria-label="Sekcje panelu"
        >
          {tabs.map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
                tab === value
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>

        {notice && (
          <p className="mt-4 rounded-xl border border-mint/25 bg-mint-soft p-3 text-sm">{notice}</p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {!data && !error && <p className="mt-8 text-sm text-muted-foreground">Wczytujemy panel…</p>}

        {data && tab === "pulpit" && (
          <div className="mt-5 space-y-5">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["Użytkownicy", data.stats.users, Users],
                ["Wszystkie oferty", data.stats.listings, ShoppingBag],
                ["Aktywne oferty", data.stats.activeListings, UserCheck],
                ["Zamówienia", data.stats.orders, Package],
                ["Zgłoszenia", data.stats.openReports, AlertTriangle],
              ].map(([label, value, Icon]) => (
                <div key={String(label)} className="card-surface p-4">
                  <Icon className="size-5 text-brand" />
                  <p className="mt-3 text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </section>
            <section className="card-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Gotowość produkcyjna</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Status integracji bez ujawniania kluczy i haseł.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(working)}
                  onClick={() => void action({ action: "reconcile_money" })}
                  className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
                >
                  Sprawdź płatności
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Stripe", modeLabel[data.stripeMode], data.stripeMode === "live"],
                  ["E-maile", modeLabel[data.emailMode], data.emailMode === "live"],
                  [
                    "Wysyłka",
                    data.shippingProvider
                      ? `${modeLabel[data.shippingMode]} · ${data.shippingProvider}`
                      : modeLabel[data.shippingMode],
                    data.shippingMode === "live",
                  ],
                  [
                    "Adres aplikacji",
                    data.appOrigin ?? "Brak",
                    Boolean(data.appOrigin?.startsWith("https://")),
                  ],
                ].map(([name, value, ready]) => (
                  <div
                    key={String(name)}
                    className="rounded-xl border border-border bg-background p-3"
                  >
                    <p className="text-xs text-muted-foreground">{name}</p>
                    <p className="mt-1 break-all text-sm font-semibold">
                      <span
                        className={cn(
                          "mr-2 inline-block size-2 rounded-full",
                          ready ? "bg-mint" : "bg-sun",
                        )}
                      />
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {data && tab === "uzytkownicy" && (
          <UsersPanel
            users={filteredUsers}
            query={query}
            setQuery={setQuery}
            working={working}
            banUser={banUser}
            deleteUser={deleteUser}
            action={action}
          />
        )}

        {data && tab === "oferty" && (
          <section className="mt-5 grid gap-3 lg:grid-cols-2">
            {data.listings.map((listing) => (
              <article key={listing.id} className="card-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold">{listing.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      @{one(listing.profiles)?.username ?? "konto usunięte"} ·{" "}
                      {(listing.price_grosz / 100).toFixed(2)} zł · {date(listing.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={listing.status} />
                </div>
                {["active", "hidden"].includes(listing.status) && (
                  <button
                    disabled={Boolean(working)}
                    onClick={() =>
                      void action({
                        action: "moderate_listing",
                        listingId: listing.id,
                        status: listing.status === "active" ? "hidden" : "active",
                      })
                    }
                    className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                  >
                    {listing.status === "active" ? "Ukryj ofertę" : "Przywróć ofertę"}
                  </button>
                )}
              </article>
            ))}
          </section>
        )}

        {data && tab === "zgloszenia" && (
          <ReportsPanel data={data} working={working} action={action} />
        )}

        {data && tab === "zamowienia" && (
          <section className="mt-5 space-y-3">
            {data.orders.map((order) => (
              <article key={order.id} className="card-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold">Zamówienie {order.id.slice(0, 8)}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Kupujący: @{one(order.buyer)?.username ?? "—"} · Sprzedający: @
                      {one(order.seller)?.username ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(order.amount_grosz / 100).toFixed(2)} zł · {date(order.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge status={order.status} />
                    <StatusBadge status={order.payment_status} />
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {data && tab === "dziennik" && (
          <section className="mt-5 space-y-2">
            {data.audit.map((entry) => (
              <article
                key={entry.id}
                className="rounded-xl border border-border bg-card p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{entry.action.replaceAll("_", " ")}</p>
                  <time className="text-xs text-muted-foreground">{date(entry.created_at)}</time>
                </div>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {entry.target_type}
                  {entry.target_id ? ` · ${entry.target_id}` : ""}
                </p>
              </article>
            ))}
            {!data.audit.length && (
              <p className="text-sm text-muted-foreground">Dziennik jest pusty.</p>
            )}
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function UsersPanel({
  users,
  query,
  setQuery,
  working,
  banUser,
  deleteUser,
  action,
}: {
  users: AdminUser[];
  query: string;
  setQuery: (value: string) => void;
  working: string | null;
  banUser: (user: AdminUser, duration: "24h" | "7d" | "30d" | "permanent") => void;
  deleteUser: (user: AdminUser) => void;
  action: (body: Record<string, unknown>, success?: string) => Promise<void>;
}) {
  return (
    <section className="mt-5">
      <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
        <Search className="size-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Szukaj po nicku, e-mailu lub mieście"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {users.map((user) => (
          <article key={user.id} className="card-surface p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-bold">@{user.username}</h2>
                  {user.isAdmin && (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                      Administrator
                    </span>
                  )}
                  <StatusBadge status={user.moderation.status} />
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {user.city ? `${user.city}, ` : ""}
                  {user.country} · od {date(user.created_at)}
                </p>
              </div>
              <Users className="size-5 shrink-0 text-muted-foreground" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <p className="rounded-lg bg-secondary p-2">
                Oferty: <strong>{user.listingCount}</strong>
              </p>
              <p className="rounded-lg bg-secondary p-2">
                Transakcje: <strong>{user.orderCount}</strong>
              </p>
            </div>
            {user.moderation.reason && (
              <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                Powód: {user.moderation.reason}
                {user.moderation.suspended_until
                  ? ` · do ${date(user.moderation.suspended_until)}`
                  : ""}
              </p>
            )}
            {!user.isAdmin && (
              <div className="mt-4 flex flex-wrap gap-2">
                {user.moderation.status === "active" ? (
                  <>
                    {(["24h", "7d", "30d"] as const).map((duration) => (
                      <button
                        key={duration}
                        disabled={Boolean(working)}
                        onClick={() => banUser(user, duration)}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                      >
                        {duration === "24h" ? "24 godz." : duration.replace("d", " dni")}
                      </button>
                    ))}
                    <button
                      disabled={Boolean(working)}
                      onClick={() => banUser(user, "permanent")}
                      className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
                    >
                      <Ban className="size-3.5" /> Na stałe
                    </button>
                  </>
                ) : (
                  <button
                    disabled={Boolean(working)}
                    onClick={() =>
                      void action(
                        { action: "unban_user", userId: user.id },
                        "Konto zostało odblokowane.",
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-mint-soft px-3 py-2 text-xs font-semibold text-mint"
                  >
                    <UserCheck className="size-3.5" /> Odblokuj
                  </button>
                )}
                <button
                  disabled={Boolean(working)}
                  onClick={() => deleteUser(user)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive"
                >
                  <Trash2 className="size-3.5" /> Usuń
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportsPanel({
  data,
  working,
  action,
}: {
  data: AdminData;
  working: string | null;
  action: (body: Record<string, unknown>, success?: string) => Promise<void>;
}) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section>
        <h2 className="font-bold">Problemy z zamówieniami ({data.problems.length})</h2>
        <div className="mt-3 space-y-3">
          {data.problems.map((problem) => (
            <article key={problem.id} className="card-surface p-4 text-sm">
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
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                >
                  Zamknij
                </button>
                <button
                  disabled={Boolean(working)}
                  onClick={() =>
                    window.confirm("Zwrócić pełną płatność kupującemu?") &&
                    void action({ action: "refund_order", orderId: problem.order_id })
                  }
                  className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground"
                >
                  Pełny zwrot
                </button>
              </div>
            </article>
          ))}
          {!data.problems.length && (
            <p className="text-sm text-muted-foreground">Brak otwartych problemów.</p>
          )}
        </div>
      </section>
      <section>
        <h2 className="font-bold">Zgłoszone oferty ({data.reports.length})</h2>
        <div className="mt-3 space-y-3">
          {data.reports.map((report) => {
            const listing = one(report.listings);
            return (
              <article key={report.id} className="card-surface p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{listing?.title ?? "Usunięta oferta"}</p>
                  {listing && <StatusBadge status={listing.status} />}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {report.reason}: {report.details || "brak szczegółów"}
                </p>
                <button
                  disabled={Boolean(working) || !listing || listing.status === "hidden"}
                  onClick={() =>
                    void action({ action: "hide_reported_listing", reportId: report.id })
                  }
                  className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {listing?.status === "hidden" ? "Oferta ukryta" : "Ukryj ofertę"}
                </button>
              </article>
            );
          })}
          {!data.reports.length && (
            <p className="text-sm text-muted-foreground">Brak zgłoszonych ofert.</p>
          )}
        </div>
      </section>
    </div>
  );
}
