'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LoginPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) console.error('getUser error:', error);

      if (user) {
        // Already signed in -> go to dashboard
        window.location.href = '/dashboard';
        return;
      }
      setLoading(false);
    })();
  }, []);

  const signInWithGoogle = async () => {
    setMsg(null);
    // Build redirect from the page you’re on (works in local + production)
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) setMsg(error.message);
    // Supabase will redirect away; no need to do anything else here
  };

  if (loading) {
    return (
      <main className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-7 w-48 bg-black/10 dark:bg-white/10 rounded" />
          <div className="h-24 w-full bg-black/5 dark:bg-white/5 rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
      <p className="text-sm text-gray-500 mb-6">
        Use your Google account to continue.
      </p>

      {msg && (
        <div className="mb-3 text-sm px-3 py-2 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800">
          {msg}
        </div>
      )}

      <button
        type="button"
        onClick={signInWithGoogle}
        className="px-4 py-2 rounded border hover:bg-black/5 dark:hover:bg-white/10"
      >
        Continue with Google
      </button>
    </main>
  );
}


