// src/app/lib/supabaseClient.ts
// Browser-only Supabase client for the app directory.
// Uses public (anon) key only — safe to ship to the browser.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  // This helps catch mis-configured .env.local during dev
  // (Next.js will inline NEXT_PUBLIC_* at build time)
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

// Ensure a single instance across HMR in dev
declare global {
  // eslint-disable-next-line no-var
  var __supabaseClient__: SupabaseClient | undefined
}

const client =
  globalThis.__supabaseClient__ ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Adjust if you want different storage key/behavior
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__supabaseClient__ = client
}

// Export as both default and named, so existing imports keep working
export { client as supabase }
export default client
