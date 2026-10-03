import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, MapPin, Pencil, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Stars } from "@/components/stars";
import {
  PROMOTE_COST,
  promoteListing,
  setListingStatus,
  useAccount,
  type ListingStatus,
} from "@/data/account";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Mój profil — Klockownia" },
      {
        name: "description",
        content:
          "Twój profil na Klockowni: opinie, opis, lokalizacja oraz Twoje ogłoszenia — aktywne, ukryte i wersje robocze.",
      },
      { property: "og:title", content: "Mój profil — Klockownia" },
      {
        property: "og:description",
        content: "Zarządzaj swoimi ogłoszeniami LEGO i wyróżnieniami w jednym miejscu.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const tabs: { key: ListingStatus; label: string }[] = [
  { key: "active", label: "Aktywne" },
  { key: "hidden", label: "Ukryte" },
  { key: "draft", label: "Wersje robocze" },
];

function ProfilePage() {
  const { profile, myListings } = useAccount();
  const [tab, setTab] = useState<ListingStatus>("active");
  const [toast, setToast] = useState<string | null>(null);

  const shown = myListings.filter((l) => l.status === tab);
  const count = (key: ListingStatus) => myListings.filter((l) => l.status === key).length;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-soft via-card to-sky-soft">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
            <img
              src={profile.avatar}
              alt={`Zdjęcie profilowe ${profile.name}`}
              width={112}
              height={112}
              className="size-24 rounded-full border-4 border-card object-cover shadow-card sm:size-28"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold sm:text-3xl">{profile.name}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Stars rating={profile.rating} />
                <span className="font-semibold text-foreground">{profile.rating}</span>
                <span>({profile.reviews} opinii)</span>
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" aria-hidden />
                {profile.country}
                {profile.city && profile.showCity ? `, ${profile.city}` : ""}
                <span className="ml-2">· na Klockowni od {profile.joined}</span>
              </p>
            </div>
            <Link
              to="/ustawienia"
              className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Pencil className="size-4" aria-hidden />
              Edytuj profil
            </Link>
          </div>
          <p className="border-t border-border/60 bg-card/70 px-6 py-5 text-sm leading-relaxed text-muted-foreground sm:px-8">
            {profile.bio || "Nie dodałeś jeszcze opisu. Kilka zdań buduje zaufanie kupujących."}
          </p>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={tab === t.key}
                className={
                  tab === t.key
                    ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    : "rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {t.label} ({count(t.key)})
              </button>
            ))}
          </div>

          {toast && (
            <p className="mt-4 rounded-xl border border-border bg-mint-soft px-4 py-2.5 text-sm">
              {toast}
            </p>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((l) => (
              <article key={l.id} className="card-surface overflow-hidden">
                <div className="relative aspect-[4/3] bg-surface">
                  <img
                    src={l.image}
                    alt={l.title}
                    width={600}
                    height={450}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                  {l.promoted && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-brand-foreground">
                      <Sparkles className="size-3" aria-hidden /> Wyróżnione
                    </span>
                  )}
                  {l.status === "hidden" && (
                    <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                      Ukryte
                    </span>
                  )}
                  {l.status === "draft" && (
                    <span className="absolute left-2 top-2 rounded-full bg-sun px-2.5 py-1 text-xs font-semibold text-sun-foreground">
                      Wersja robocza
                    </span>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.theme} · {l.condition}
                    {l.status !== "draft" && ` · ${l.views} wyświetleń`}
                  </p>
                  <p className="pt-1 text-base font-bold">
                    {l.status === "draft" ? "Cena nieustawiona" : `${l.price} zł`}
                  </p>
                </div>
                <div className="flex gap-2 border-t border-border p-3">
                  {l.status === "draft" ? (
                    <Link
                      to="/sprzedaj"
                      className="flex-1 rounded-full bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground"
                    >
                      Dokończ ogłoszenie
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={l.promoted}
                        onClick={() => setToast(promoteListing(l.id).reason)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        <Sparkles className="size-3.5" aria-hidden />
                        {l.promoted ? "Wyróżnione" : `Podbij · ${PROMOTE_COST} zł`}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setListingStatus(l.id, l.status === "hidden" ? "active" : "hidden")
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
                      >
                        {l.status === "hidden" ? (
                          <>
                            <Eye className="size-3.5" aria-hidden /> Pokaż
                          </>
                        ) : (
                          <>
                            <EyeOff className="size-3.5" aria-hidden /> Ukryj
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>

          {shown.length === 0 && (
            <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nic tutaj nie ma.{" "}
              <Link to="/sprzedaj" className="font-semibold text-brand">
                Wystaw pierwsze ogłoszenie
              </Link>
              .
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
