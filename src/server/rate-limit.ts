import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export class RateLimitExceededError extends Error {
  constructor() {
    super("Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.");
    this.name = "RateLimitExceededError";
  }
}

export async function enforceRateLimit(
  admin: SupabaseClient,
  scope: string,
  identity: string,
  limit: number,
  windowSeconds: number,
) {
  const keyHash = createHash("sha256").update(`${scope}:${identity}`).digest("hex");
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_scope: scope,
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error("Rate limit unavailable");
  if (data !== true) throw new RateLimitExceededError();
}
