// src/utils/supabase/server.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

// At runtime we still want to fail fast if missing
if (!supabaseUrl) {
  throw new Error("Supabase URL is not set. Check SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
}
if (!serviceRoleKey) {
  throw new Error("Supabase service role key is not set. Check SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE.");
}

// Tell TS these are now plain strings
const SUPABASE_URL: string = supabaseUrl;
const SUPABASE_SERVICE_ROLE_KEY: string = serviceRoleKey;

export function createServerSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });
}
