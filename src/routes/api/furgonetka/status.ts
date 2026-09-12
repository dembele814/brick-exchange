import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  return error ? null : data.user;
}

export const Route = createFileRoute("/api/furgonetka/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!hasSupabaseAdminConfig()) return Response.json({ connected: false });
        const user = await authenticatedUser(request);
        if (!user) return Response.json({ error: "Zaloguj się ponownie." }, { status: 401 });
        const { data, error } = await getSupabaseAdmin()
          .from("shipping_provider_accounts")
          .select("connected_at")
          .eq("user_id", user.id)
          .eq("provider", "furgonetka")
          .maybeSingle();
        if (error) return Response.json({ connected: false });
        return Response.json({ connected: Boolean(data), connectedAt: data?.connected_at ?? null });
      },
    },
  },
});
