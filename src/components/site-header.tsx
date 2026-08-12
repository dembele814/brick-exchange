import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Plus, Search, User } from "lucide-react";
import { useUnreadCount } from "@/data/messages";

export function SiteHeader() {
  const unread = useUnreadCount();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="grid grid-cols-2 gap-[2px]">
            <i className="block size-2 rounded-[2px] bg-brand" />
            <i className="block size-2 rounded-[2px] bg-sun" />
            <i className="block size-2 rounded-[2px] bg-sun" />
            <i className="block size-2 rounded-[2px] bg-brand" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Klockownia</span>
        </Link>

        <label className="ml-2 hidden flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm focus-within:ring-2 focus-within:ring-ring/40 sm:flex">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            type="search"
            placeholder="Szukaj zestawu, numeru lub serii"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>

        <nav className="ml-auto flex items-center gap-1">
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
          <button
            type="button"
            aria-label="Ulubione"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Heart className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Konto"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <User className="size-5" />
          </button>
          <Link
            to="/sprzedaj"
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
