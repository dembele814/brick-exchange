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
  const { favorites, userId } = useAccount();
  const liked = favorites.includes(listing.id);
  const isOwnListing = Boolean(userId && listing.seller.id === userId);

  return (
    <article className="group relative">
      <Link
        to="/oferta/$id"
        params={{ id: listing.id }}
        className="block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-brand/40"
      >
        <div className="relative aspect-square overflow-hidden bg-surface before:absolute before:inset-x-0 before:bottom-0 before:z-10 before:h-1/3 before:bg-gradient-to-t before:from-primary/15 before:to-transparent">
          <img
            src={listing.image}
            alt={listing.title}
            width={800}
            height={800}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          {listing.condition === "Nowy w pudełku" && (
            <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-background/85 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur">
              Nowy
            </span>
          )}
          {listing.promoted && (
            <span className="button-gradient absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
              <Sparkles className="size-3" aria-hidden />
              Wyróżnione
            </span>
          )}
        </div>
        <div className="space-y-1.5 p-4 pb-16">
          <p className="truncate text-sm font-bold">{listing.title}</p>
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
          "absolute right-3 top-3 rounded-xl border border-white/10 bg-background/80 p-2 shadow-card backdrop-blur transition-all hover:scale-105 hover:text-brand",
          liked ? "text-brand" : "text-muted-foreground",
        )}
      >
        <Heart className={cn("size-4", liked && "fill-brand")} />
      </button>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-4 pb-4">
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
          disabled={isOwnListing}
          onClick={() =>
            guard(() => {
              return startConversation(listing.id).then((id) =>
                navigate({ to: "/wiadomosci", search: { c: id } }),
              );
            })
          }
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-brand/25 bg-brand-soft px-3 py-1.5 text-xs font-semibold transition-all hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-50"
          title={isOwnListing ? "To Twoja oferta" : "Napisz do sprzedającego"}
        >
          <MessageCircle className="size-3.5" aria-hidden />
          {isOwnListing ? "Twoja oferta" : "Napisz"}
        </button>
      </div>
    </article>
  );
}
