import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"];
const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

/** Browser client. RLS, not this key, controls access to application data. */
export const supabase =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export function requireSupabase() {
  if (!supabase) throw new Error("Brakuje konfiguracji Supabase. Uzupełnij .env.");
  return supabase;
}
