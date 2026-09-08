import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, SearchX } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listing-card";
import { useFavoriteListings } from "@/data/marketplace";
import { useAccount } from "@/data/account";

export const Route = createFileRoute("/ulubione")({
  head: () => ({ meta: [{ title: "Ulubione oferty — Klockownia" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { loggedIn } = useAccount();
  const { items, loading, error } = useFavoriteListings();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-8 text-primary-foreground sm:px-9">
          <div className="absolute -right-8 -top-10 size-40 rounded-full bg-brand/25 blur-2xl" />
          <Heart className="relative size-7 fill-brand text-brand" aria-hidden />
          <h1 className="relative mt-3 font-display text-3xl font-bold">Twoje ulubione</h1>
          <p className="relative mt-2 max-w-xl text-sm text-primary-foreground/70">Zapisane zestawy są tutaj zawsze pod ręką. Gdy oferta zniknie, nie pokażemy jej jako dostępnej.</p>
        </section>

        {!loggedIn ? (
          <div className="card-surface mt-6 p-10 text-center">
            <SearchX className="mx-auto size-7 text-brand" />
            <h2 className="mt-3 font-semibold">Zaloguj się, aby zobaczyć zapisane oferty</h2>
            <Link to="/logowanie" className="mt-5 inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground">Przejdź do logowania</Link>
          </div>
        ) : loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Wczytujemy ulubione…</p>
        ) : error ? (
          <p className="mt-8 text-sm text-destructive">{error}</p>
        ) : items.length ? (
          <div className="mt-7 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        ) : (
          <div className="card-surface mt-6 p-10 text-center">
            <Heart className="mx-auto size-8 text-brand" />
            <h2 className="mt-3 font-semibold">Nie masz jeszcze ulubionych ofert</h2>
            <p className="mt-1 text-sm text-muted-foreground">Kliknij serce przy ogłoszeniu, aby wrócić do niego później.</p>
            <Link to="/" search={{ q: undefined }} className="mt-5 inline-flex rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-secondary">Przeglądaj oferty</Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
