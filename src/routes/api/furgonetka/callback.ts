import { createFileRoute } from "@tanstack/react-router";
import {
  encryptFurgonetkaToken,
  exchangeAuthorizationCode,
  readOAuthState,
  tokenExpiresAt,
} from "@/server/furgonetka";
import { getSupabaseAdmin } from "@/server/supabase-admin";

function redirect(request: Request, result: "connected" | "error") {
  const url = new URL("/ustawienia", request.url);
  url.searchParams.set("shipping", result);
  return Response.redirect(url, 303);
}

export const Route = createFileRoute("/api/furgonetka/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state || url.searchParams.has("error")) return redirect(request, "error");
        try {
          const userId = readOAuthState(state);
          const tokens = await exchangeAuthorizationCode(code);
          const { error } = await getSupabaseAdmin()
            .from("shipping_provider_accounts")
            .upsert(
              {
                user_id: userId,
                provider: "furgonetka",
                access_token_encrypted: encryptFurgonetkaToken(tokens.accessToken),
                refresh_token_encrypted: encryptFurgonetkaToken(tokens.refreshToken),
                access_token_expires_at: tokenExpiresAt(tokens.expiresIn),
                connected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,provider" },
            );
          if (error) throw error;
          return redirect(request, "connected");
        } catch {
          return redirect(request, "error");
        }
      },
    },
  },
});
