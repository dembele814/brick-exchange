import { createClient } from "@supabase/supabase-js";
import { publicSupabaseUrl } from "@/lib/public-supabase-config";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

export function hasSupabaseAdminConfig() {
  return Boolean(process.env["KLOCKOWNIA_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"]);
}

function serviceRoleKey() {
  return process.env["KLOCKOWNIA_SERVICE_ROLE_KEY"] || required("SUPABASE_SERVICE_ROLE_KEY");
}

/** Use only in server functions/routes. It bypasses RLS. */
export function getSupabaseAdmin() {
  return createClient(process.env["VITE_SUPABASE_URL"] || publicSupabaseUrl, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
