import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Heart, MessageCircle, Plus, Search } from "lucide-react";
import { useUnreadCount } from "@/data/messages";
import { useNotifications } from "@/data/notifications";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { UserMenu } from "@/components/user-menu";

export function SiteHeader() {
  const unread = useUnreadCount();
  const { unread: notificationUnread } = useNotifications();
  const { loggedIn } = useAuthGate();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link to="/" search={{ q: undefined }} className="flex shrink-0 items-center gap-2">
          <span className="grid grid-cols-2 gap-[2px]">
            <i className="block size-2 rounded-[2px] bg-brand" />
            <i className="block size-2 rounded-[2px] bg-sun" />
            <i className="block size-2 rounded-[2px] bg-sun" />
            <i className="block size-2 rounded-[2px] bg-brand" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Klockownia</span>
        </Link>

        <form
          className="ml-2 hidden flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm focus-within:ring-2 focus-within:ring-ring/40 sm:flex"
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

        <nav className="ml-auto flex items-center gap-1">
          <Link
            to={loggedIn ? "/powiadomienia" : "/logowanie"}
            aria-label={
              notificationUnread > 0 ? `Powiadomienia, ${notificationUnread} nowe` : "Powiadomienia"
            }
            className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
            className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Heart className="size-5" />
          </Link>
          <UserMenu />
          <Link
            to={loggedIn ? "/sprzedaj" : "/logowanie"}
            className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" />
            Wystaw
          </Link>
        </nav>
      </div>
    </header>
  );
}
