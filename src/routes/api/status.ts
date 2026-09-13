import { createFileRoute } from "@tanstack/react-router";
import { paymentConfig } from "@/server/payments";

export const Route = createFileRoute("/api/status")({
  server: {
    handlers: {
      GET: async () => {
        let stripeMode: "test" | "live" | "unconfigured" = "unconfigured";
        try {
          stripeMode = paymentConfig().liveMode ? "live" : "test";
        } catch {
          // Only expose the integration state. Configuration details remain server-side.
        }
        return Response.json(
          { stripeMode },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
