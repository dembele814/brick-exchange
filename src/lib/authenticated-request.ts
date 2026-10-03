import type { SupabaseClient } from "@supabase/supabase-js";

/** Retry only an authentication rejection: no order was created by a 401. */
export async function authenticatedRequest(
  client: SupabaseClient,
  url: string,
  init: RequestInit,
  send: typeof fetch = fetch,
) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("Twoja sesja wygasła. Zaloguj się ponownie.");
  const request = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return send(url, { ...init, headers });
  };
  const response = await request(data.session.access_token);
  if (response.status !== 401) return response;
  const refreshed = await client.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session)
    throw new Error("Nie udało się odświeżyć sesji. Spróbuj ponownie lub zaloguj się jeszcze raz.");
  return request(refreshed.data.session.access_token);
}
