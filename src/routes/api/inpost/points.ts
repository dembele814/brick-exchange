import { createFileRoute } from "@tanstack/react-router";
import { searchInpostPoints } from "@/server/inpost";

export const Route = createFileRoute("/api/inpost/points")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const query = url.searchParams.get("q")?.trim() ?? "";
        const hasLocation = url.searchParams.has("lat") && url.searchParams.has("lon");
        if (!query && !hasLocation)
          return Response.json(
            { error: "Wpisz miasto, ulicę albo udostępnij lokalizację." },
            { status: 400 },
          );
        try {
          const points = await searchInpostPoints({
            ...(query ? { query } : {}),
            ...(hasLocation
              ? {
                  latitude: Number(url.searchParams.get("lat")),
                  longitude: Number(url.searchParams.get("lon")),
                }
              : {}),
          });
          return Response.json(
            { points },
            { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
          );
        } catch (error) {
          return Response.json(
            {
              error: error instanceof Error ? error.message : "Nie udało się znaleźć Paczkomatów.",
            },
            { status: 502 },
          );
        }
      },
    },
  },
});
