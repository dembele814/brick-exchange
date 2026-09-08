import { createClient } from "@supabase/supabase-js";
import { publicSupabaseUrl } from "@/lib/public-supabase-config";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

/** Use only in server functions/routes. It bypasses RLS. */
export function getSupabaseAdmin() {
  return createClient(process.env["VITE_SUPABASE_URL"] || publicSupabaseUrl, required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
