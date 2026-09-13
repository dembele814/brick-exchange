import { useCallback, useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { LoaderCircle, LocateFixed, MapPin, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type LockerPoint = {
  id: string;
  name: string;
  address: string;
  city: string;
  status: string;
  description: string;
  openingHours: string;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
};

type Props = {
  selected: LockerPoint | null;
  onSelect: (point: LockerPoint) => void;
};

export function InpostMapPicker({ selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const onSelectRef = useRef(onSelect);
  const [query, setQuery] = useState("");
  const [points, setPoints] = useState<LockerPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationDialog, setLocationDialog] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  onSelectRef.current = onSelect;

  const loadPoints = useCallback(async (params: URLSearchParams) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/inpost/points?${params}`, { signal: controller.signal });
      const body = (await response.json()) as { points?: LockerPoint[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Nie udało się znaleźć Paczkomatów.");
      const next = body.points ?? [];
      setPoints(next);
      if (next.length === 0) setError("Nie znaleziono punktów w tym obszarze.");
      return next;
    } catch (caught) {
      if (controller.signal.aborted) return [];
      setError(caught instanceof Error ? caught.message : "Nie udało się znaleźć Paczkomatów.");
      return [];
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let moveTimer: number | undefined;
    void import("leaflet").then((leaflet) => {
      if (disposed || !containerRef.current || mapRef.current) return;
      const map = leaflet.map(containerRef.current, {
        zoomControl: true,
        minZoom: 5,
        maxZoom: 19,
      });
      map.setView([52.1, 19.4], 6);
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        })
        .addTo(map);
      markersRef.current = leaflet.layerGroup().addTo(map);
      mapRef.current = map;

      const refreshVisibleArea = () => {
        window.clearTimeout(moveTimer);
        moveTimer = window.setTimeout(() => {
          const center = map.getCenter();
          const radius = Math.min(
            700_000,
            Math.max(5_000, Math.round(center.distanceTo(map.getBounds().getNorthEast()))),
          );
          void loadPoints(
            new URLSearchParams({
              lat: String(center.lat),
              lon: String(center.lng),
              radius: String(radius),
              limit: "100",
            }),
          );
        }, 300);
      };
      map.on("moveend", refreshVisibleArea);
      refreshVisibleArea();
    });
    return () => {
      disposed = true;
      window.clearTimeout(moveTimer);
      requestRef.current?.abort();
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, [loadPoints]);

  useEffect(() => {
    if (!markersRef.current) return;
    let cancelled = false;
    void import("leaflet").then((leaflet) => {
      if (cancelled || !markersRef.current) return;
      markersRef.current.clearLayers();
      for (const point of points) {
        const active = point.id === selected?.id;
        const icon = leaflet.divIcon({
          className: "",
          html: `<span aria-hidden="true" style="display:block;width:${active ? 34 : 28}px;height:${active ? 34 : 28}px;border-radius:999px;background:${active ? "#dc2626" : "#111827"};border:4px solid white;box-shadow:0 2px 10px rgba(0,0,0,.45)"></span>`,
          iconSize: [active ? 34 : 28, active ? 34 : 28],
          iconAnchor: [active ? 17 : 14, active ? 17 : 14],
        });
        const tooltip = document.createElement("span");
        tooltip.textContent = `${point.id} · ${point.address}`;
        leaflet
          .marker([point.latitude, point.longitude], {
            icon,
            title: `Wybierz ${point.id}: ${point.address}`,
            keyboard: true,
            bubblingMouseEvents: false,
          })
          .on("click", () => {
            onSelectRef.current(point);
            mapRef.current?.panTo([point.latitude, point.longitude]);
          })
          .bindTooltip(tooltip, { direction: "top" })
          .addTo(markersRef.current);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [points, selected?.id]);

  const search = async () => {
    if (query.trim().length < 2) {
      setError("Wpisz miasto albo ulicę.");
      return;
    }
    const results = await loadPoints(new URLSearchParams({ q: query.trim(), limit: "100" }));
    const first = results[0];
    if (first) mapRef.current?.setView([first.latitude, first.longitude], 13);
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError("Ta przeglądarka nie obsługuje lokalizacji.");
      setLocationDialog(false);
      return;
    }
    setLocationDialog(false);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setPermissionBlocked(false);
        const { latitude, longitude } = position.coords;
        mapRef.current?.setView([latitude, longitude], 14);
        await loadPoints(
          new URLSearchParams({
            lat: String(latitude),
            lon: String(longitude),
            radius: "10000",
            limit: "100",
          }),
        );
      },
      (locationError) => {
        setLoading(false);
        setPermissionBlocked(locationError.code === locationError.PERMISSION_DENIED);
        setError(
          locationError.code === locationError.PERMISSION_DENIED
            ? "Lokalizacja jest zablokowana dla tej strony. Otwórz ustawienia witryny przy pasku adresu i wybierz „Lokalizacja: Zezwalaj”."
            : "Nie udało się ustalić lokalizacji. Spróbuj ponownie albo wyszukaj miejsce.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-brand/25 bg-brand/5 px-4 py-3">
        <p className="text-sm font-bold">Kliknij wybrany Paczkomat bezpośrednio na mapie</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Wyszukiwanie miasta jest opcjonalne — nie musisz nic wpisywać.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
            placeholder="Wpisz miasto lub ulicę"
            aria-label="Wyszukaj Paczkomat po miejscu"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Szukaj na mapie
        </button>
        <button
          type="button"
          onClick={() => setLocationDialog(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
        >
          <LocateFixed className="size-4" aria-hidden /> Blisko mnie
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary">
        <div
          ref={containerRef}
          className="h-[420px] w-full sm:h-[480px]"
          aria-label="Mapa Paczkomatów InPost"
        />
        {loading && (
          <div className="pointer-events-none absolute left-3 top-3 z-[500] inline-flex items-center gap-2 rounded-full bg-card/95 px-3 py-2 text-xs font-semibold shadow-card">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Ładujemy punkty…
          </div>
        )}
        {selected && (
          <div className="absolute inset-x-3 bottom-3 z-[500] rounded-xl border border-brand/30 bg-card/95 p-3 shadow-lift backdrop-blur">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <div>
                <p className="text-sm font-bold">Wybrano Paczkomat</p>
                <p className="text-sm">{selected.address}</p>
                {selected.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{selected.description}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Przesuwaj i przybliżaj mapę. Kliknij czarny punkt, aby wybrać Paczkomat.
      </p>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      {permissionBlocked && (
        <button
          type="button"
          onClick={() => setLocationDialog(true)}
          className="text-xs font-semibold text-brand underline underline-offset-2"
        >
          Jak włączyć lokalizację?
        </button>
      )}
      <input type="hidden" name="lockerId" value={selected?.id ?? ""} />

      <Dialog open={locationDialog} onOpenChange={setLocationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pokaż Paczkomaty blisko Ciebie</DialogTitle>
            <DialogDescription>
              Po kliknięciu poniżej przeglądarka pokaże małe okno zgody. Wybierz „Zezwól”.
              Lokalizacja służy tylko do znalezienia pobliskich punktów.
            </DialogDescription>
          </DialogHeader>
          {permissionBlocked && (
            <p className="rounded-xl border border-sun/30 bg-sun-soft p-3 text-sm">
              Jeśli zgoda była wcześniej zablokowana, kliknij ikonę ustawień obok adresu strony,
              ustaw „Lokalizacja” na „Zezwalaj” i odśwież stronę.
            </p>
          )}
          <button
            type="button"
            onClick={requestLocation}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground"
          >
            <LocateFixed className="size-4" aria-hidden /> Udostępnij lokalizację
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
