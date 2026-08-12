import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { startConversation } from "@/data/messages";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listing-card";
import { getListing, listings } from "@/data/listings";
import {
  ArrowLeft,
  Check,
  Heart,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";

export const Route = createFileRoute("/oferta/$id")({
  loader: ({ params }) => {
    const listing = getListing(params.id);
    if (!listing) throw notFound();
    return { listing };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Oferta niedostępna — Klockownia" }, { name: "robots", content: "noindex" }],
      };
    }
    const { listing } = loaderData;
    const title = `${listing.title} — ${listing.price} zł | Klockownia`;
    const description = `${listing.theme}, ${listing.pieces} elementów, stan: ${listing.condition}. Wysyłka z ${listing.city}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: OfferPage,
});

function OfferPage() {
  const { listing } = Route.useLoaderData();
  const navigate = useNavigate();
  const similar = listings.filter((l) => l.id !== listing.id).slice(0, 4);

  const facts: [string, boolean][] = [
    ["Komplet elementów", listing.complete],
    ["Instrukcja", listing.instructions],
    ["Oryginalne pudełko", listing.box],
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Wróć do ofert
        </Link>

        <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <img
              src={listing.image}
              alt={listing.title}
              width={800}
              height={800}
              className="aspect-square w-full object-cover"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{listing.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Nr zestawu {listing.setNumber} · {listing.theme} · rok {listing.year}
            </p>

            <p className="mt-5 text-3xl font-bold">
              {listing.price} zł
              {listing.original && (
                <span className="ml-3 text-base font-normal text-muted-foreground line-through">
                  {listing.original} zł
                </span>
              )}
            </p>

            <div className="card-surface mt-4 space-y-1.5 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <ShieldCheck className="size-4 text-brand" aria-hidden />
                  Bezpieczny zakup
                </span>
                <span>{safeBuy.toFixed(2)} zł</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                <span>Do zapłaty</span>
                <span>{total.toFixed(2)} zł</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Bezpieczny zakup obejmuje ochronę płatności i pomoc, jeśli przesyłka nie dotrze
                zgodnie z opisem.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-foreground">
                {listing.condition}
              </span>
              <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                {listing.pieces} elementów
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                <MapPin className="size-3.5" /> {listing.city}
              </span>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
              >
                Kup teraz
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = startConversation(listing.id);
                  navigate({ to: "/wiadomosci", search: { c: id } });
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                <MessageCircle className="size-4" aria-hidden />
                Napisz do sprzedającego
              </button>
              <button
                type="button"
                aria-label="Dodaj do ulubionych"
                className="rounded-full border border-border bg-card p-3 text-muted-foreground transition-colors hover:text-brand"
              >
                <Heart className="size-5" />
              </button>
            </div>

            <ul className="mt-6 space-y-2">
              {facts.map(([label, ok]) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  {ok ? (
                    <Check className="size-4 text-brand" aria-hidden />
                  ) : (
                    <X className="size-4 text-muted-foreground" aria-hidden />
                  )}
                  <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              {listing.description}
            </p>

            <div className="card-surface mt-7 flex items-center gap-3 p-4">
              <span className="grid size-11 place-items-center rounded-full bg-secondary text-sm font-bold">
                {listing.seller.name.slice(0, 1)}
              </span>
              <div className="text-sm">
                <p className="font-semibold">{listing.seller.name}</p>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Star className="size-3.5 fill-sun text-sun" aria-hidden />
                  {listing.seller.rating} · {listing.seller.sales} sprzedaży
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-14">
          <h2 className="text-lg font-semibold">Podobne oferty</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {similar.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
