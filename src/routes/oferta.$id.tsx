import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { startConversation, useAcceptedOfferPrice } from "@/data/messages";
import { toggleFavorite, useAccount } from "@/data/account";
import { reportListing, startCheckout, useListing, usePublicListings } from "@/data/marketplace";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listing-card";
import { getListing, listings } from "@/data/listings";
import {
  ArrowLeft,
  Check,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Maximize2,
  PackageCheck,
  Share2,
  ShieldCheck,
  Star,
  Truck,
  X,
} from "lucide-react";

const shippingOptions = [
  { id: "inpost", label: "InPost", hint: "Paczkomat", point: "Kod Paczkomatu, np. WAW01A" },
  {
    id: "orlen",
    label: "ORLEN Paczka",
    hint: "Punkt lub automat",
    point: "Kod punktu ORLEN Paczki",
  },
  { id: "dpd", label: "DPD Pickup", hint: "Punkt odbioru", point: "Kod punktu DPD Pickup" },
  { id: "dhl", label: "DHL POP", hint: "Punkt lub DHL BOX", point: "Kod punktu DHL POP / BOX" },
] as const;

export const Route = createFileRoute("/oferta/$id")({
  validateSearch: z.object({ offer: z.string().uuid().optional() }),
  head: () => ({ meta: [{ title: "Oferta — Klockownia" }] }),
  component: OfferPage,
});

function OfferPage() {
  const { id } = Route.useParams();
  const { offer } = Route.useSearch();
  const fixture = getListing(id);
  const { item: liveListing, loading } = useListing(id);
  const { items: liveListings } = usePublicListings();
  const listing = liveListing ?? fixture;
  const navigate = useNavigate();
  const { guard } = useAuthGate();
  const { favorites, profile, userId } = useAccount();
  const acceptedOfferPrice = useAcceptedOfferPrice(offer, id);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const isOwnListing = Boolean(liveListing && userId && listing?.seller.id === userId);
  const [submitting, setSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");
  const [carrier, setCarrier] = useState<(typeof shippingOptions)[number]["id"]>("inpost");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [reportSending, setReportSending] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => setSelectedImage(""), [id]);
  useEffect(() => {
    if (!lightboxOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [lightboxOpen]);
  if (!listing) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <PackageCheck className="mx-auto size-10 text-brand" />
          <h1 className="mt-4 text-2xl font-bold">
            {loading ? "Wczytujemy ofertę…" : "Ta oferta nie jest już dostępna"}
          </h1>
          {!loading && (
            <Link
              to="/"
              search={{ q: undefined }}
              className="mt-5 inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground"
            >
              Wróć do ofert
            </Link>
          )}
        </main>
        <SiteFooter />
      </div>
    );
  }

  const liked = favorites.includes(listing.id);
  const gallery = listing.images?.length ? listing.images : [listing.image];
  const displayedImage = selectedImage || gallery[0]!;
  const similarSource = liveListings.length > 0 ? liveListings : listings;
  const similar = similarSource
    .filter((candidate) => candidate.id !== listing.id && candidate.theme === listing.theme)
    .slice(0, 4);

  const facts: [string, boolean][] = [
    ["Komplet elementów", listing.complete],
    ["Instrukcja", listing.instructions],
    ["Oryginalne pudełko", listing.box],
  ];
  const checkoutPrice = acceptedOfferPrice ?? listing.price;

  const shareOffer = async () => {
    const url = window.location.href;
    try {
      if (navigator.share)
        await navigator.share({
          title: listing.title,
          text: `Zobacz ofertę: ${listing.title}`,
          url,
        });
      else await navigator.clipboard.writeText(url);
      setShareMessage("Link do oferty jest gotowy do udostępnienia.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareMessage("Nie udało się skopiować linku. Skopiuj adres z paska przeglądarki.");
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link
          to="/"
          search={{ q: undefined }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Wróć do ofert
        </Link>

        <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <button
            type="button"
            aria-label={`Powiększ zdjęcie oferty ${listing.title}`}
            onClick={() => setLightboxOpen(true)}
            className="group relative overflow-hidden rounded-3xl border border-border bg-surface text-left shadow-card focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <img
              src={displayedImage}
              alt={listing.title}
              width={800}
              height={800}
              className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
            <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-foreground/75 px-3 py-2 text-xs font-semibold text-background opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus:opacity-100">
              <Maximize2 className="size-3.5" aria-hidden /> Powiększ
            </span>
          </button>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {gallery.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setSelectedImage(image)}
                  aria-label={`Pokaż zdjęcie ${index + 1}`}
                  aria-pressed={displayedImage === image}
                  className={
                    displayedImage === image
                      ? "size-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-brand ring-offset-2 ring-offset-background"
                      : "size-16 shrink-0 overflow-hidden rounded-xl opacity-70 transition-opacity hover:opacity-100"
                  }
                >
                  <img src={image} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{listing.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Nr zestawu {listing.setNumber} · {listing.theme} · rok {listing.year}
            </p>

            <p className="mt-5 text-3xl font-bold">
              {checkoutPrice} zł
              {listing.original && (
                <span className="ml-3 text-base font-normal text-muted-foreground line-through">
                  {listing.original} zł
                </span>
              )}
            </p>
            {acceptedOfferPrice !== null && (
              <p className="mt-2 rounded-xl border border-mint/30 bg-mint-soft px-3 py-2 text-sm font-semibold">
                Sprzedawca zaakceptował tę cenę w rozmowie.
              </p>
            )}

            <p className="mt-3 rounded-xl border border-sky/25 bg-sky-soft/60 px-3 py-2 text-xs leading-relaxed text-foreground">
              Sprzedający oświadczył, że sprzedaje prywatnie. Do zakupu nie stosuje się ustawowego
              14-dniowego prawa odstąpienia przysługującego przy zakupie od przedsiębiorcy.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-foreground">
                {listing.condition}
              </span>
              <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                {listing.pieces} elementów
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                <MapPin className="size-3.5" aria-hidden /> {listing.city}
              </span>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={listing.seller.away || isOwnListing}
                onClick={() =>
                  guard(() => {
                    setCheckoutError(null);
                    if (!liveListing) {
                      setCheckoutError(
                        "Płatność jest dostępna dla ofert opublikowanych w Klockowni. Wybierz ofertę z bieżącej listy.",
                      );
                      return;
                    }
                    setCheckoutOpen(true);
                  })
                }
                className="flex-1 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isOwnListing ? "To Twoja oferta" : "Kup testowo"}
              </button>
              <button
                type="button"
                disabled={isOwnListing}
                onClick={() =>
                  guard(() => {
                    return startConversation(listing.id).then((conversationId) =>
                      navigate({ to: "/wiadomosci", search: { c: conversationId } }),
                    );
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageCircle className="size-4" aria-hidden />
                Napisz do sprzedającego
              </button>
              <button
                type="button"
                aria-label={liked ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
                aria-pressed={liked}
                onClick={() => guard(() => toggleFavorite(listing.id))}
                className={cn(
                  "rounded-full border border-border bg-card p-3 transition-colors hover:text-brand",
                  liked ? "text-brand" : "text-muted-foreground",
                )}
              >
                <Heart className={cn("size-5", liked && "fill-brand")} />
              </button>
              <button
                type="button"
                onClick={() => void shareOffer()}
                aria-label="Udostępnij ofertę"
                className="rounded-full border border-border bg-card p-3 text-muted-foreground transition-colors hover:text-brand"
              >
                <Share2 className="size-5" aria-hidden />
              </button>
            </div>

            {shareMessage && (
              <p className="mt-2 text-xs font-medium text-muted-foreground">{shareMessage}</p>
            )}

            {listing.seller.away && (
              <p className="mt-3 rounded-xl border border-sun/30 bg-sun-soft px-3 py-2 text-sm font-medium text-foreground">
                Sprzedawca ma włączony tryb wakacyjny — zakup jest chwilowo niedostępny.
              </p>
            )}

            {isOwnListing && (
              <p className="mt-3 rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground">
                To Twoja oferta. Możesz nią zarządzać w swoim profilu.
              </p>
            )}

            {checkoutError && <p className="mt-3 text-sm text-destructive">{checkoutError}</p>}

            {checkoutOpen && (
              <form
                className="card-surface mt-5 space-y-4 border-brand/25 p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  setSubmitting(true);
                  setCheckoutError(null);
                  void startCheckout({
                    listingId: listing.id,
                    ...(acceptedOfferPrice !== null && offer ? { acceptedOfferId: offer } : {}),
                    carrier,
                    lockerId: String(form.get("lockerId") ?? ""),
                    receiver: {
                      email: String(form.get("email") ?? ""),
                      phone: String(form.get("phone") ?? ""),
                      firstName: String(form.get("firstName") ?? ""),
                      lastName: String(form.get("lastName") ?? ""),
                    },
                  })
                    .catch((error) =>
                      setCheckoutError(
                        error instanceof Error
                          ? error.message
                          : "Nie udało się rozpocząć płatności.",
                      ),
                    )
                    .finally(() => setSubmitting(false));
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">Wybierz punkt odbioru</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Dane odbiorcy trafiają wyłącznie do zamówienia i przewoźnika po opłaceniu.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckoutOpen(false)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Anuluj
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {shippingOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setCarrier(option.id)}
                      aria-pressed={carrier === option.id}
                      className={
                        carrier === option.id
                          ? "rounded-xl bg-primary px-3 py-2.5 text-left text-sm text-primary-foreground shadow-card"
                          : "rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm hover:bg-secondary"
                      }
                    >
                      <span className="block font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-xs opacity-70">{option.hint}</span>
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    name="firstName"
                    required
                    defaultValue={profile.realName.split(" ")[0] ?? ""}
                    placeholder="Imię"
                    className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
                  />
                  <input
                    name="lastName"
                    required
                    defaultValue={profile.realName.split(" ").slice(1).join(" ")}
                    placeholder="Nazwisko"
                    className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
                  />
                  <input
                    name="email"
                    required
                    type="email"
                    defaultValue={profile.email}
                    placeholder="E-mail"
                    className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
                  />
                  <input
                    name="phone"
                    required
                    type="tel"
                    defaultValue={profile.phone}
                    placeholder="Telefon"
                    className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
                  />
                </div>
                <input
                  name="lockerId"
                  required
                  minLength={3}
                  placeholder={shippingOptions.find((option) => option.id === carrier)?.point}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
                />
                <p className="rounded-xl border border-sun/30 bg-sun-soft px-3 py-2 text-xs font-medium text-foreground">
                  Płatność testowa: użyj karty 4242 4242 4242 4242, przyszłej daty i dowolnego CVC.
                  Żadne prawdziwe środki nie zostaną pobrane.
                </p>
                <button
                  disabled={submitting}
                  className="w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground disabled:opacity-60"
                >
                  {submitting
                    ? "Przekierowujemy do płatności…"
                    : `Przejdź do płatności testowej · ${checkoutPrice.toFixed(2)} zł`}
                </button>
              </form>
            )}

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

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-mint/25 bg-mint-soft/70 p-3.5">
                <Truck className="size-4 text-mint" aria-hidden />
                <p className="mt-2 text-sm font-semibold">Odbiór w punkcie</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  InPost, ORLEN, DPD Pickup lub DHL POP — wybierzesz przed płatnością.
                </p>
              </div>
              <div className="rounded-2xl border border-sky/20 bg-sky-soft/70 p-3.5">
                <ShieldCheck className="size-4 text-sky" aria-hidden />
                <p className="mt-2 text-sm font-semibold">Płatność testowa Stripe</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  To test integracji. Prawdziwe płatności i wypłaty sprzedawców nie są jeszcze
                  aktywne.
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              {listing.description}
            </p>

            <div className="mt-5 border-t border-border/70 pt-4">
              <button
                type="button"
                onClick={() =>
                  guard(() => {
                    setReportOpen((open) => !open);
                    setReportMessage(null);
                  })
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
              >
                <Flag className="size-3.5" aria-hidden /> Zgłoś tę ofertę
              </button>
              {reportOpen && (
                <form
                  className="mt-3 rounded-2xl border border-border bg-secondary/45 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    setReportSending(true);
                    setReportMessage(null);
                    void reportListing(
                      listing.id,
                      String(form.get("reason")) as
                        "misleading" | "counterfeit" | "prohibited" | "spam" | "other",
                      String(form.get("details") ?? ""),
                    )
                      .then(() => {
                        setReportOpen(false);
                        setReportMessage(
                          "Dziękujemy — zgłoszenie zostało zapisane do weryfikacji.",
                        );
                      })
                      .catch((error) =>
                        setReportMessage(
                          error instanceof Error
                            ? error.message
                            : "Nie udało się wysłać zgłoszenia.",
                        ),
                      )
                      .finally(() => setReportSending(false));
                  }}
                >
                  <p className="text-sm font-semibold">Co jest nie tak z ofertą?</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <select
                      name="reason"
                      defaultValue="misleading"
                      className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
                    >
                      <option value="misleading">Opis lub zdjęcia wprowadzają w błąd</option>
                      <option value="counterfeit">Podejrzenie podróbki</option>
                      <option value="prohibited">Niedozwolony przedmiot</option>
                      <option value="spam">Spam lub duplikat</option>
                      <option value="other">Inny powód</option>
                    </select>
                    <textarea
                      name="details"
                      maxLength={1000}
                      rows={2}
                      placeholder="Krótko opisz problem (opcjonalnie)"
                      className="resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setReportOpen(false)}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      Anuluj
                    </button>
                    <button
                      disabled={reportSending}
                      className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
                    >
                      {reportSending ? "Wysyłanie…" : "Wyślij zgłoszenie"}
                    </button>
                  </div>
                </form>
              )}
              {reportMessage && (
                <p className="mt-3 text-xs font-medium text-muted-foreground">{reportMessage}</p>
              )}
            </div>

            <Link
              to="/uzytkownik/$name"
              params={{ name: listing.seller.name }}
              className="card-surface mt-7 flex items-center gap-3 p-4 transition-shadow hover:shadow-lift"
            >
              <span className="grid size-11 place-items-center rounded-full bg-secondary text-sm font-bold">
                {listing.seller.name.slice(0, 1)}
              </span>
              <div className="text-sm">
                <p className="font-semibold">{listing.seller.name}</p>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Star className="size-3.5 fill-sun text-sun" aria-hidden />
                  {listing.seller.rating} · {listing.seller.sales} sprzedaży
                </p>
                <p className="mt-0.5 text-xs font-semibold text-brand">
                  Zobacz profil i wszystkie ogłoszenia
                </p>
              </div>
            </Link>
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
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Powiększone zdjęcie: ${listing.title}`}
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/85 p-4 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-h-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={displayedImage}
              alt={listing.title}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute -right-2 -top-2 grid size-9 place-items-center rounded-full bg-card text-foreground shadow-card"
              aria-label="Zamknij powiększenie"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
      <SiteFooter />
    </div>
  );
}
