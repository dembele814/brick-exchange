import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, PackageOpen, Star } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ListingCard } from "@/components/listing-card";
import { listings } from "@/data/listings";
import { usePublicListings, usePublicSellerProfile } from "@/data/marketplace";

export const Route = createFileRoute("/uzytkownik/$name")({
  head: () => ({ meta: [{ title: "Profil sprzedającego — Klockownia" }] }),
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
  const { name: rawName } = Route.useParams();
  const name = decodeURIComponent(rawName);
  const { profile, loading: profileLoading } = usePublicSellerProfile(name);
  const { items: publicListings, loading: listingsLoading } = usePublicListings();
  const fixtureListings = listings.filter((listing) => listing.seller.name === name);
  const sellerListings = profile ? publicListings.filter((listing) => listing.seller.name === profile.name) : fixtureListings;
  const city = profile?.city ?? sellerListings[0]?.city;

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
            <p className="mt-1 text-sm text-muted-foreground">
              {profile ? `Sprzedawca na Klockowni od ${profile.joined}` : "Sprzedawca na Klockowni"}
            </p>
            {profile?.rating !== null && profile?.rating !== undefined && <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold"><Star className="size-4 fill-sun text-sun" /> {profile.rating.toFixed(1)} <span className="font-normal text-muted-foreground">· {profile.reviews.length} opinii</span></p>}
            {city && (
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden /> {city}
              </p>
            )}
          </div>
        </section>

        {profile && profile.reviews.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">Opinie kupujących</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {profile.reviews.map((review) => (
                <li key={review.id} className="card-surface p-4">
                  <p className="flex items-center gap-1 text-sm font-semibold"><Star className="size-4 fill-sun text-sun" /> {review.rating}/5</p>
                  {review.body && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.body}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{review.at}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {profile?.bio && <p className="card-surface mt-4 max-w-3xl p-5 text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>}

        <section className="mt-10">
          <h2 className="text-lg font-semibold">
            Ogłoszenia użytkownika ({sellerListings.length})
          </h2>
          {(profileLoading || listingsLoading) && <p className="mt-3 text-sm text-muted-foreground">Wczytujemy profil i oferty…</p>}
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
              <Link to="/" search={{ q: undefined }} className="text-sm font-semibold text-brand hover:underline">
                Zobacz inne oferty
              </Link>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
