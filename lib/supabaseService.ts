// src/lib/supabaseService.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceSupabaseClientOrError():
  | { client: SupabaseClient; error?: undefined }
  | { client?: undefined; error: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) return { error: "Missing NEXT_PUBLIC_SUPABASE_URL" };
  if (!key) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY" };

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "email-router-admin-service" } },
  });

  return { client };
}
