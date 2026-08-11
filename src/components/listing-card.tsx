import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, MessageCircle } from "lucide-react";
import { startConversation } from "@/data/messages";
import type { Listing } from "@/data/listings";

export function ListingCard({ listing }: { listing: Listing }) {
  const navigate = useNavigate();

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

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => {
            const id = startConversation(listing.id);
            navigate({ to: "/wiadomosci", search: { c: id } });
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
        >
          <MessageCircle className="size-3.5" aria-hidden />
          Napisz do sprzedającego
        </button>
      </div>
    </article>
  );
}
