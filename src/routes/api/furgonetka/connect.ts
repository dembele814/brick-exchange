import { createFileRoute } from "@tanstack/react-router";
import { furgonetkaAuthorizationUrl } from "@/server/furgonetka";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  return error ? null : data.user;
}

export const Route = createFileRoute("/api/furgonetka/connect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasSupabaseAdminConfig())
          return Response.json(
            { error: "Połączenie wysyłek nie jest skonfigurowane." },
            { status: 503 },
          );
        const user = await authenticatedUser(request);
        if (!user) return Response.json({ error: "Zaloguj się ponownie." }, { status: 401 });
        try {
          return Response.json({ url: furgonetkaAuthorizationUrl(user.id) });
        } catch {
          return Response.json(
            { error: "Furgonetka nie jest jeszcze skonfigurowana." },
            { status: 503 },
          );
        }
      },
    },
  },
});
