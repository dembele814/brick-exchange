import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Heart, MessageCircle, Plus, Search } from "lucide-react";
import { useUnreadCount } from "@/data/messages";
import { useNotifications } from "@/data/notifications";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { UserMenu } from "@/components/user-menu";
import { usePublicStatus } from "@/data/public-status";
import { BrandLogo } from "@/components/brand-logo";

export function SiteHeader() {
  const unread = useUnreadCount();
  const { unread: notificationUnread } = useNotifications();
  const { loggedIn } = useAuthGate();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { data: publicStatus } = usePublicStatus();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-2xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link
          to="/"
          search={{ q: undefined }}
          className="shrink-0"
          aria-label="Klockogram — strona główna"
        >
          <span className="sm:hidden">
            <BrandLogo compact />
          </span>
          <span className="hidden sm:inline-flex">
            <BrandLogo />
          </span>
        </Link>

        <form
          className="ml-3 hidden max-w-xl flex-1 items-center gap-2 rounded-2xl border border-border bg-card/70 px-4 py-2.5 text-sm shadow-card transition-colors focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-ring/25 md:flex"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ to: "/", search: { q: query.trim() || undefined } });
          }}
        >
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj zestawu, numeru lub serii"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </form>

        <nav className="ml-auto flex items-center gap-0.5 sm:gap-1">
          <Link
            to={loggedIn ? "/powiadomienia" : "/logowanie"}
            aria-label={
              notificationUnread > 0 ? `Powiadomienia, ${notificationUnread} nowe` : "Powiadomienia"
            }
            className="relative rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Bell className="size-5" />
            {notificationUnread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-sun px-1 text-[10px] font-bold leading-4 text-primary">
                {notificationUnread}
              </span>
            )}
          </Link>
          <Link
            to="/wiadomosci"
            search={{ c: undefined }}
            aria-label={unread > 0 ? `Wiadomości, ${unread} nowe` : "Wiadomości"}
            className="relative rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <MessageCircle className="size-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-brand-foreground">
                {unread}
              </span>
            )}
          </Link>
          <Link
            to={loggedIn ? "/ulubione" : "/logowanie"}
            aria-label="Ulubione"
            className="hidden rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
          >
            <Heart className="size-5" />
          </Link>
          <UserMenu />
          <Link
            to={loggedIn ? "/sprzedaj" : "/logowanie"}
            className="button-gradient ml-1 inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-all sm:px-4"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Wystaw</span>
          </Link>
        </nav>
      </div>
      {publicStatus?.stripeMode !== "live" && publicStatus && (
        <div className="border-t border-sun/20 bg-sun/10 px-4 py-1.5 text-center text-xs font-medium text-foreground">
          {publicStatus.stripeMode === "test"
            ? "Wersja testowa — płatności Stripe nie pobierają prawdziwych pieniędzy."
            : "Płatności są chwilowo niedostępne."}
        </div>
      )}
    </header>
  );
}
