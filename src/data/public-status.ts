import { useQuery } from "@tanstack/react-query";

type PublicStatus = {
  stripeMode: "test" | "live" | "unconfigured";
};

export function usePublicStatus() {
  return useQuery({
    queryKey: ["public-status"],
    queryFn: async () => {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Nie udało się sprawdzić statusu płatności.");
      return (await response.json()) as PublicStatus;
    },
    staleTime: 30_000,
  });
}
