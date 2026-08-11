import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import type { Listing } from "@/data/listings";

export function ListingCard({ listing }: { listing: Listing }) {
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
        </div>
        <div className="space-y-1 p-3">
          <p className="truncate text-sm font-medium">{listing.title}</p>
          <p className="text-xs text-muted-foreground">
            {listing.theme} · {listing.pieces} el. · {listing.condition}
          </p>
          <p className="pt-1 text-base font-bold">
            {listing.price} zł
            {listing.original && (
              <span className="ml-2 text-xs font-normal text-muted-foreground line-through">
                {listing.original} zł
              </span>
            )}
          </p>
        </div>
      </Link>
      <button
        type="button"
        aria-label="Dodaj do ulubionych"
        className="absolute right-2 top-2 rounded-full bg-card/90 p-2 text-muted-foreground shadow-card transition-colors hover:text-brand"
      >
        <Heart className="size-4" />
      </button>
    </article>
  );
}
