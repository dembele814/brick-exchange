import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, MessageCircle, Sparkles } from "lucide-react";
import { startConversation } from "@/data/messages";
import type { Listing } from "@/data/listings";
import { toggleFavorite, useAccount } from "@/data/account";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { cn } from "@/lib/utils";

export function ListingCard({ listing }: { listing: Listing }) {
  const navigate = useNavigate();
  const { guard } = useAuthGate();
  const { favorites } = useAccount();
  const liked = favorites.includes(listing.id);

  return (
    <article className="group relative">
      <Link
        to="/oferta/$id"
        params={{ id: listing.id }}
        className="block overflow-hidden rounded-xl border border-border bg-card shadow-card transition-shadow hover:shadow-lift"
      >
        <div className="relative aspect-square overflow-hidden bg-surface">
          <img
            src={listing.image}
            alt={listing.title}
            width={800}
            height={800}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          {listing.condition === "Nowy w pudełku" && (
            <span className="absolute left-2 top-2 rounded-full bg-sun px-2.5 py-1 text-xs font-semibold text-sun-foreground">
              Nowy
            </span>
          )}
          {listing.promoted && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-brand-foreground shadow-sm">
              <Sparkles className="size-3" aria-hidden />
              Wyróżnione
            </span>
          )}
        </div>
        <div className="space-y-1 p-3 pb-14">
          <p className="truncate text-sm font-medium">{listing.title}</p>
          <p className="text-xs text-muted-foreground">
            {listing.theme} · {listing.pieces} el. · {listing.condition}
          </p>
        </div>
      </Link>

      <button
        type="button"
        aria-label={liked ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
        aria-pressed={liked}
        onClick={() => guard(() => toggleFavorite(listing.id))}
        className={cn(
          "absolute right-2 top-2 rounded-full bg-card/90 p-2 shadow-card transition-colors hover:text-brand",
          liked ? "text-brand" : "text-muted-foreground",
        )}
      >
        <Heart className={cn("size-4", liked && "fill-brand")} />
      </button>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-3 pb-3">
        <p className="text-base font-bold">
          {listing.price} zł
          {listing.original && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground line-through">
              {listing.original} zł
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() =>
            guard(() => {
              const id = startConversation(listing.id);
              navigate({ to: "/wiadomosci", search: { c: id } });
            })
          }
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-brand-soft"
          title="Napisz do sprzedającego"
        >
          <MessageCircle className="size-3.5" aria-hidden />
          Napisz
        </button>
      </div>
    </article>
  );
}
