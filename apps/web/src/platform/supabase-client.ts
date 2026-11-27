import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { WEB_AUTH_OPTIONS, type WebSupabaseConfig } from "./supabase-config.js";

export { readWebSupabaseConfig, WEB_AUTH_OPTIONS, type WebRuntimeEnv, type WebSupabaseConfig } from "./supabase-config.js";

export function createWebSupabaseClient(
  config: WebSupabaseConfig,
): SupabaseClient {
  return createClient(config.url, config.publishableKey, {
    auth: WEB_AUTH_OPTIONS,
  });
}
