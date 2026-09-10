import { legoSeries } from "@/data/listings";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Star, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { createListing } from "@/data/marketplace";

export const Route = createFileRoute("/sprzedaj")({
  head: () => ({
    meta: [
      { title: "Dodaj ofertę LEGO — Klockownia" },
      {
        name: "description",
        content:
          "Wystaw zestaw, minifigurki lub klocki luzem w kilku krokach: do 20 zdjęć, stan, braki, cena, wysyłka i płatność.",
      },
      { property: "og:title", content: "Dodaj ofertę LEGO — Klockownia" },
      {
        property: "og:description",
        content: "Darmowe wystawienie oferty, prowizja tylko po sprzedaży.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SellPage,
});

const MAX_PHOTOS = 20;

const categories = ["Zestawy LEGO", "Minifigurki", "Części na sztuki", "Klocki luzem"];
const popularMotifs = ["City", "Star Wars", "Technic", "Harry Potter", "Ninjago", "Marvel"];
const conditionLevels = ["Popękane", "Lekko zarysowane", "W porządku", "Błyszczące", "Nowe"];

type Photo = { id: string; url: string; name: string; file: File };

function Chips({
  options,
  value,
  onChange,
  name,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
            value === o
              ? "border-brand bg-brand text-brand-foreground"
              : "border-border bg-card hover:bg-secondary",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function SellPage() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState(categories[0]!);
  const [motif, setMotif] = useState(popularMotifs[0]!);
  const [condition, setCondition] = useState(conditionLevels[2]!);
  const [hasManual, setHasManual] = useState(false);
  const [hasBox, setHasBox] = useState(false);
  const [parcelTemplate, setParcelTemplate] = useState<"small" | "medium" | "large">("medium");
  const [price, setPrice] = useState("");
  const [title, setTitle] = useState("");
  const [setNumber, setSetNumber] = useState("");
  const [pieces, setPieces] = useState("");
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privateSaleConfirmed, setPrivateSaleConfirmed] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const field =
    "mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40";

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const all = Array.from(files);
    const next = all
      .filter(
        (f) =>
          ["image/jpeg", "image/png", "image/webp"].includes(f.type) && f.size <= 10 * 1024 * 1024,
      )
      .slice(0, Math.max(room, 0))
      .map((f) => ({
        id: `${f.name}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        url: URL.createObjectURL(f),
        name: f.name,
        file: f,
      }));
    setPhotos((p) => [...p, ...next]);
    if (all.length !== next.length)
      setError("Pomijamy pliki inne niż JPG, PNG, WebP lub większe niż 10 MB.");
  };

  const removePhoto = (id: string) =>
    setPhotos((p) => {
      const target = p.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return p.filter((x) => x.id !== id);
    });

  const makeCover = (id: string) =>
    setPhotos((p) => {
      const i = p.findIndex((x) => x.id === id);
      if (i <= 0) return p;
      const copy = [...p];
      const [item] = copy.splice(i, 1);
      if (item) copy.unshift(item);
      return copy;
    });

  const movePhoto = (id: string, direction: -1 | 1) =>
    setPhotos((current) => {
      const index = current.findIndex((photo) => photo.id === id);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length) return current;
      const copy = [...current];
      const [photo] = copy.splice(index, 1);
      if (photo) copy.splice(destination, 0, photo);
      return copy;
    });

  const priceNum = Number(price) || 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold">Dodaj ofertę</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kilka pól, jedno zdjęcie na okładkę i gotowe. Wystawienie jest darmowe.
        </p>

        <form
          className="mt-8 space-y-8"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!privateSaleConfirmed) {
              setError("Potwierdź, że sprzedajesz jako osoba prywatna.");
              return;
            }
            setSaving(true);
            setError(null);
            try {
              await createListing({
                title,
                description,
                category,
                theme: motif,
                condition,
                price: priceNum,
                setNumber,
                pieces: pieces.trim() ? Number(pieces) : null,
                year: year.trim() ? Number(year) : null,
                hasInstructions: hasManual,
                hasBox,
                parcelTemplate,
                photos: photos.map((photo) => photo.file),
              });
              setSent(true);
              window.setTimeout(() => navigate({ to: "/", search: { q: undefined } }), 900);
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Nie udało się opublikować oferty.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          {/* Zdjęcia */}
          <section>
            <h2 className="text-sm font-semibold">
              Zdjęcia{" "}
              <span className="font-normal text-muted-foreground">
                ({photos.length}/{MAX_PHOTOS}) · wymagane
              </span>
            </h2>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "card-surface mt-2 flex flex-col items-center gap-3 border-dashed p-8 text-center transition-colors",
                dragging && "border-brand bg-brand-soft/50",
              )}
            >
              <ImagePlus className="size-6 text-brand" aria-hidden />
              <p className="text-sm font-medium">Przeciągnij i upuść zdjęcia tutaj</p>
              <p className="text-xs text-muted-foreground">
                Pierwsze zdjęcie będzie okładką oferty. JPG, PNG lub WebP, maks. 10 MB. Do{" "}
                {MAX_PHOTOS} zdjęć.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
                >
                  <Upload className="size-4" aria-hidden /> Wybierz z dysku
                </button>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary"
                >
                  <Camera className="size-4" aria-hidden /> Zrób zdjęcie
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {photos.length > 0 && (
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((p, i) => (
                  <li
                    key={p.id}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface"
                  >
                    <img
                      src={p.url}
                      alt={`Zdjęcie oferty ${i + 1}: ${p.name}`}
                      className="size-full object-cover"
                    />
                    {i === 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground">
                        Okładka
                      </span>
                    )}
                    <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => movePhoto(p.id, -1)}
                          aria-label="Przesuń zdjęcie wcześniej"
                          className="rounded-full bg-card/90 p-1.5 shadow-card hover:bg-card"
                        >
                          <ChevronLeft className="size-3.5" aria-hidden />
                        </button>
                      )}
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => makeCover(p.id)}
                          aria-label="Ustaw jako okładkę"
                          className="rounded-full bg-card/90 p-1.5 shadow-card hover:bg-card"
                        >
                          <Star className="size-3.5" aria-hidden />
                        </button>
                      )}
                      {i < photos.length - 1 && (
                        <button
                          type="button"
                          onClick={() => movePhoto(p.id, 1)}
                          aria-label="Przesuń zdjęcie później"
                          className="rounded-full bg-card/90 p-1.5 shadow-card hover:bg-card"
                        >
                          <ChevronRight className="size-3.5" aria-hidden />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id)}
                        aria-label="Usuń zdjęcie"
                        className="ml-auto rounded-full bg-card/90 p-1.5 shadow-card hover:bg-card"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Podstawy */}
          <section className="space-y-5">
            <label className="block text-sm font-medium">
              Tytuł oferty
              <input
                required
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Remiza strażacka 60215, komplet"
                className={field}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm font-medium">
                Numer zestawu
                <input
                  value={setNumber}
                  onChange={(e) => setSetNumber(e.target.value)}
                  maxLength={50}
                  placeholder="np. 10305"
                  className={field}
                />
              </label>
              <label className="block text-sm font-medium">
                Elementy
                <input
                  value={pieces}
                  onChange={(e) => setPieces(e.target.value)}
                  inputMode="numeric"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="np. 1038"
                  className={field}
                />
              </label>
              <label className="block text-sm font-medium">
                Rok wydania
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  inputMode="numeric"
                  type="number"
                  min="1949"
                  max={new Date().getFullYear() + 1}
                  step="1"
                  placeholder="np. 2023"
                  className={field}
                />
              </label>
            </div>
            <p className="-mt-3 text-xs text-muted-foreground">
              Pola opcjonalne, ale pomagają kupującym łatwiej znaleźć właściwy zestaw.
            </p>

            <div>
              <span className="text-sm font-medium">Kategoria</span>
              <Chips
                name="Kategoria"
                options={categories}
                value={category}
                onChange={setCategory}
              />
            </div>

            <div>
              <span className="text-sm font-medium">Motyw / seria</span>
              <Chips name="Motyw" options={popularMotifs} value={motif} onChange={setMotif} />
              <select
                value={popularMotifs.includes(motif) ? "" : motif}
                onChange={(e) => e.target.value && setMotif(e.target.value)}
                aria-label="Wszystkie serie LEGO"
                className={field}
              >
                <option value="">Inna seria LEGO…</option>
                {legoSeries.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <label className="block text-sm font-medium">
              Opis
              <textarea
                rows={5}
                maxLength={1500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Historia zestawu, kompletność, stan naklejek, sposób pakowania…"
                className={field}
              />
            </label>
          </section>

          {/* Stan */}
          <section className="space-y-5">
            <h2 className="text-sm font-semibold">Stan</h2>
            <div>
              <span className="text-sm font-medium">Rodzaj stanu</span>
              <Chips
                name="Rodzaj stanu"
                options={conditionLevels}
                value={condition}
                onChange={setCondition}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Od najgorszego do najlepszego: popękane → nowe.
              </p>
            </div>
            <fieldset>
              <legend className="text-sm font-medium">Co dołączasz do zestawu?</legend>
              <p className="mt-1 text-xs text-muted-foreground">
                Zaznacz, jeśli masz — możesz też zostawić odznaczone.
              </p>
              <div className="mt-2 space-y-2">
                <label className="card-surface flex items-center gap-3 p-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={hasManual}
                    onChange={(e) => setHasManual(e.target.checked)}
                  />
                  Instrukcja
                </label>
                <label className="card-surface flex items-center gap-3 p-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={hasBox}
                    onChange={(e) => setHasBox(e.target.checked)}
                  />
                  Oryginalne pudełko
                </label>
              </div>
            </fieldset>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Rozmiar paczki InPost</h2>
            <p className="text-xs text-muted-foreground">
              Wybierz najmniejszą skrytkę, w której zmieści się zapakowany zestaw.
            </p>
            <select
              value={parcelTemplate}
              onChange={(event) =>
                setParcelTemplate(event.target.value as "small" | "medium" | "large")
              }
              className={field}
              aria-label="Rozmiar paczki InPost"
            >
              <option value="small">Mała — gabaryt A, do 8 × 38 × 64 cm</option>
              <option value="medium">Średnia — gabaryt B, do 19 × 38 × 64 cm</option>
              <option value="large">Duża — gabaryt C, do 41 × 38 × 64 cm</option>
            </select>
          </section>

          {/* Cena */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Cena</h2>
            <label className="block text-sm font-medium">
              Cena (zł)
              <input
                required
                type="number"
                min={1}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="249"
                className={field}
              />
            </label>
            <div className="card-surface space-y-2 p-4 text-sm">
              <div className="flex justify-between">
                <span>Prowizja Klockowni</span>
                <span>{Math.min(priceNum, 1 + Math.round(priceNum * 5) / 100).toFixed(2)} zł</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Otrzymasz po odbiorze</span>
                <span>
                  {Math.max(
                    0,
                    priceNum - Math.min(priceNum, 1 + Math.round(priceNum * 5) / 100),
                  ).toFixed(2)}{" "}
                  zł
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Prowizja: 1 zł + 5% ceny.</p>
            </div>
          </section>

          <label className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
            <input
              required
              type="checkbox"
              checked={privateSaleConfirmed}
              onChange={(event) => setPrivateSaleConfirmed(event.target.checked)}
              className="mt-0.5 size-4 accent-brand"
            />
            <span>
              Sprzedaję jako osoba prywatna, a podane informacje i zdjęcia są zgodne z prawdą.
              Rozumiem, że kupującemu nie przysługuje ustawowe 14-dniowe odstąpienie konsumenckie.
            </span>
          </label>

          <button
            type="submit"
            disabled={saving || !privateSaleConfirmed}
            className="w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Publikuję…" : "Opublikuj ofertę"}
          </button>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {sent && (
            <p className="rounded-lg bg-brand-soft px-4 py-3 text-sm">
              Oferta opublikowana. Przenoszę Cię do najnowszych ogłoszeń.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
