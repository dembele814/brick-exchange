import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, PackageOpen } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ListingCard } from "@/components/listing-card";
import { Stars } from "@/components/stars";
import { listings } from "@/data/listings";
import { getReviews } from "@/data/reviews";

export const Route = createFileRoute("/uzytkownik/$name")({
  loader: ({ params }) => {
    const name = decodeURIComponent(params.name);
    const sellerListings = listings.filter((l) => l.seller.name === name);
    const seller = sellerListings[0]?.seller ?? { name, rating: 0, sales: 0 };
    return { name, seller, sellerListings };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.name ?? "Sprzedający";
    const title = `${name} — profil sprzedającego | Klockownia`;
    const description = `Oferty LEGO użytkownika ${name}, średnia ocena i opinie kupujących na Klockowni.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: () => (
    <p className="p-10 text-center text-sm text-muted-foreground">
      Nie udało się wczytać profilu. Odśwież stronę.
    </p>
  ),
  notFoundComponent: () => (
    <p className="p-10 text-center text-sm text-muted-foreground">Nie ma takiego użytkownika.</p>
  ),
  component: SellerProfilePage,
});

function SellerProfilePage() {
  const { name, seller, sellerListings } = Route.useLoaderData();
  const reviews = seller.sales > 0 ? getReviews(name, seller.rating) : [];
  const city = sellerListings[0]?.city;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="card-surface flex flex-wrap items-center gap-4 p-5">
          <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-sun/60 to-brand-soft text-xl font-bold">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">{name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Stars rating={seller.rating} />
              <span>
                {seller.rating.toFixed(1)} · {reviews.length} opinii · {seller.sales} sprzedaży
              </span>
            </p>
            {city && (
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden /> {city}
              </p>
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">
            Ogłoszenia użytkownika ({sellerListings.length})
          </h2>
          {sellerListings.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {sellerListings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          ) : (
            <div className="card-surface mt-5 flex flex-col items-center gap-2 p-10 text-center">
              <PackageOpen className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Ten użytkownik nie ma teraz żadnych ogłoszeń.</p>
              <Link to="/" className="text-sm font-semibold text-brand hover:underline">
                Zobacz inne oferty
              </Link>
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold">Opinie</h2>
          {reviews.length > 0 ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {reviews.map((r) => (
                <li key={r.id} className="card-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{r.author}</p>
                    <Stars rating={r.rating} size={14} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.text}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{r.at}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="card-surface mt-5 p-6 text-sm text-muted-foreground">
              Ten użytkownik nie ma jeszcze opinii.
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
