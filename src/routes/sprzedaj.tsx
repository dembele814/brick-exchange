import { legoSeries } from "@/data/listings";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Camera, ImagePlus, Star, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

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
const boxState = ["Z pudełkiem", "Bez pudełka"];

type Photo = { id: string; url: string; name: string };

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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState(categories[0]!);
  const [motif, setMotif] = useState(popularMotifs[0]!);
  const [used, setUsed] = useState(usage[1]!);
  const [box, setBox] = useState(boxState[0]!);
  const [hasFlaws, setHasFlaws] = useState(false);
  const [price, setPrice] = useState("");
  const [parcel, setParcel] = useState(true);
  const [courier, setCourier] = useState(false);
  const [pickup, setPickup] = useState(false);
  const [payout, setPayout] = useState("Przelew na konto");
  const [sent, setSent] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const field =
    "mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40";

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(room, 0))
      .map((f) => ({
        id: `${f.name}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        url: URL.createObjectURL(f),
        name: f.name,
      }));
    setPhotos((p) => [...p, ...next]);
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

  const priceNum = Number(price) || 0;
  const fee = Math.round(priceNum * COMMISSION * 100) / 100;
  const payoutValue = Math.round((priceNum - fee) * 100) / 100;

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
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          {/* Zdjęcia */}
          <section>
            <h2 className="text-sm font-semibold">
              Zdjęcia{" "}
              <span className="font-normal text-muted-foreground">
                ({photos.length}/{MAX_PHOTOS})
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
                Pierwsze zdjęcie będzie okładką oferty. Do {MAX_PHOTOS} zdjęć.
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
                accept="image/*"
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
                accept="image/*"
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
                          onClick={() => makeCover(p.id)}
                          aria-label="Ustaw jako okładkę"
                          className="rounded-full bg-card/90 p-1.5 shadow-card hover:bg-card"
                        >
                          <Star className="size-3.5" aria-hidden />
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
                placeholder="np. Remiza strażacka 60215, komplet"
                className={field}
              />
            </label>

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
                placeholder="Historia zestawu, kompletność, stan naklejek, sposób pakowania…"
                className={field}
              />
            </label>
          </section>

          {/* Stan */}
          <section className="space-y-5">
            <h2 className="text-sm font-semibold">Stan</h2>
            <Chips name="Zużycie" options={usage} value={used} onChange={setUsed} />
            <Chips name="Pudełko" options={boxState} value={box} onChange={setBox} />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={hasFlaws}
                onChange={(e) => setHasFlaws(e.target.checked)}
              />
              Widoczne braki lub uszkodzenia
            </label>
            {hasFlaws && (
              <label className="block text-sm font-medium">
                Opisz braki
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="np. brak 3 elementów dekoracyjnych, przetarty nadruk na torsie"
                  className={field}
                />
              </label>
            )}
          </section>

          {/* Cena i prowizja */}
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
            <div className="card-surface space-y-1.5 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cena dla kupującego</span>
                <span>{priceNum.toFixed(2)} zł</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prowizja platformy (5%)</span>
                <span>−{fee.toFixed(2)} zł</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                <span>Otrzymasz</span>
                <span>{Math.max(payoutValue, 0).toFixed(2)} zł</span>
              </div>
            </div>
          </section>

          {/* Dostawa */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Dostawa</h2>
            <label className="card-surface flex items-center gap-3 p-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={parcel}
                onChange={(e) => setParcel(e.target.checked)}
              />
              <span>
                Paczkomat
                <span className="block text-xs text-muted-foreground">
                  Najtańsza opcja, kupujący wybiera punkt.
                </span>
              </span>
            </label>
            <label className="card-surface flex items-center gap-3 p-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={courier}
                onChange={(e) => setCourier(e.target.checked)}
              />
              <span>
                Kurier
                <span className="block text-xs text-muted-foreground">
                  Dla dużych zestawów i przesyłek ponad 10 kg.
                </span>
              </span>
            </label>
            <label className="card-surface flex items-center gap-3 p-3 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={pickup}
                onChange={(e) => setPickup(e.target.checked)}
              />
              <span>
                Odbiór osobisty
                <span className="block text-xs text-muted-foreground">
                  Bez kosztów dostawy, płatność przy odbiorze.
                </span>
              </span>
            </label>
            {pickup && (
              <label className="block text-sm font-medium">
                Miasto odbioru
                <input placeholder="np. Warszawa" className={field} />
              </label>
            )}
          </section>

          {/* Płatności */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Płatności</h2>
            <label className="block text-sm font-medium">
              Wypłata środków
              <select
                className={field}
                value={payout}
                onChange={(e) => setPayout(e.target.value)}
              >
                <option>Przelew na konto</option>
                <option>BLIK na numer telefonu</option>
                <option>Saldo w Klockowni</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              {payout === "BLIK na numer telefonu" ? "Numer telefonu" : "Numer konta / dane"}
              <input
                placeholder={
                  payout === "BLIK na numer telefonu" ? "600 000 000" : "PL00 0000 0000 0000"
                }
                className={field}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Środki trafiają do Ciebie po potwierdzeniu odbioru przez kupującego. Prowizja 5%
              pobierana jest tylko od sprzedanych ofert.
            </p>
          </section>

          <button
            type="submit"
            className="w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
          >
            Opublikuj ofertę
          </button>

          {sent && (
            <p className="rounded-lg bg-brand-soft px-4 py-3 text-sm">
              Podgląd oferty gotowy: {category} · {motif} · {used}, {box.toLowerCase()} ·{" "}
              {priceNum.toFixed(2)} zł. Publikacja na żywo pojawi się, gdy podłączymy konta
              użytkowników i płatności.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
