import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, MapPin, Pencil, Sparkles, Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AccountGate } from "@/components/account-gate";
import { Stars } from "@/components/stars";
import {
  PROMOTE_COST,
  promoteListing,
  useAccount,
  type ListingStatus,
} from "@/data/account";
import { deleteListing, updateListingDetails, updateListingStatus, useMyListings } from "@/data/marketplace";

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
  const { profile, loggedIn } = useAccount();
  const { items: myListings, loading, reload } = useMyListings();
  const [tab, setTab] = useState<ListingStatus>("active");
  const [toast, setToast] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const shown = myListings.filter((l) => l.status === tab);
  const count = (key: ListingStatus) => myListings.filter((l) => l.status === key).length;

  if (!loggedIn) return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-5xl px-4 py-12"><AccountGate feature="swój profil" /></main><SiteFooter /></div>;

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
              className="inline-flex items-center gap-1.5 self-start rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
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
                onClick={() => {
                  setTab(t.key);
                  setToast(null);
                }}
                aria-pressed={tab === t.key}
                className={
                  tab === t.key
                    ? "rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
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
                      className="flex-1 rounded-full bg-brand px-3 py-2 text-center text-xs font-semibold text-brand-foreground"
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
                        onClick={() => {
                          void updateListingStatus(l.id, l.status === "hidden" ? "active" : "hidden")
                            .then(reload)
                            .catch(() => setToast("Nie udało się zmienić widoczności ogłoszenia."));
                        }}
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
                      <button type="button" onClick={() => setEditingId(editingId === l.id ? null : l.id)} className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-secondary">Edytuj</button>
                      <button
                        type="button"
                        disabled={deletingId === l.id}
                        onClick={() => {
                          if (!window.confirm(`Usunąć ogłoszenie „${l.title}”? Tej czynności nie można cofnąć.`)) return;
                          setDeletingId(l.id);
                          void deleteListing(l.id).then(() => { setToast("Ogłoszenie zostało usunięte."); return reload(); }).catch((error) => setToast(error instanceof Error ? error.message : "Nie udało się usunąć ogłoszenia.")).finally(() => setDeletingId(null));
                        }}
                        className="rounded-full border border-destructive/40 bg-card px-2.5 py-2 text-destructive hover:bg-destructive/10 disabled:opacity-60"
                        aria-label={`Usuń ogłoszenie ${l.title}`}
                        title="Usuń ogłoszenie"
                      ><Trash2 className="size-3.5" /></button>
                    </>
                  )}
                </div>
                {editingId === l.id && (
                  <form
                    className="space-y-2 border-t border-border bg-secondary/40 p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      setSavingEdit(true);
                      void updateListingDetails(l.id, { title: String(form.get("title") ?? ""), price: Number(form.get("price")), description: String(form.get("description") ?? ""), condition: String(form.get("condition") ?? ""), setNumber: String(form.get("setNumber") ?? ""), pieces: String(form.get("pieces") ?? "").trim() ? Number(form.get("pieces")) : null, year: String(form.get("year") ?? "").trim() ? Number(form.get("year")) : null })
                        .then(() => { setEditingId(null); setToast("Zmiany w ogłoszeniu zapisano."); return reload(); })
                        .catch((error) => setToast(error instanceof Error ? error.message : "Nie udało się zapisać zmian."))
                        .finally(() => setSavingEdit(false));
                    }}
                  >
                    <input name="title" required maxLength={80} defaultValue={l.title} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none" />
                    <select name="condition" defaultValue={l.condition} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none"><option>Popękane</option><option>Lekko zarysowane</option><option>W porządku</option><option>Błyszczące</option><option>Nowe</option></select>
                    <div className="grid grid-cols-3 gap-2"><input name="setNumber" maxLength={50} defaultValue={l.setNumber} placeholder="Nr zestawu" className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none" /><input name="pieces" type="number" min="0" step="1" defaultValue={l.pieces ?? ""} placeholder="Elementy" className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none" /><input name="year" type="number" min="1949" max={new Date().getFullYear() + 1} step="1" defaultValue={l.year ?? ""} placeholder="Rok" className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none" /></div>
                    <textarea name="description" maxLength={1500} rows={3} defaultValue={l.description} placeholder="Opis oferty" className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none" />
                    <div className="flex gap-2"><input name="price" required type="number" min="1" step="0.01" defaultValue={l.price} className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none" /><button disabled={savingEdit} className="rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">{savingEdit ? "Zapis…" : "Zapisz"}</button></div>
                  </form>
                )}
              </article>
            ))}
          </div>

          {loading && <p className="mt-6 text-sm text-muted-foreground">Wczytuję Twoje ogłoszenia…</p>}
          {!loading && shown.length === 0 && (
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
