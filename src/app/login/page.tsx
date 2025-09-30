'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // If already signed in, go straight to dashboard
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session ?? null;

        if (!cancelled) {
          if (session?.user) {
            router.replace('/dashboard');
          } else {
            setChecking(false);
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Unable to check session. Please try again.');
          setChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      // After OAuth, return the user to the dashboard in this same origin
      const redirectTo = `${window.location.origin}/dashboard`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (oauthError) {
        setError(oauthError.message ?? 'Sign-in failed.');
      }
      // Supabase will redirect; no further action required here.
    } catch (err) {
      console.error(err);
      setError('Unexpected error starting Google sign-in.');
    }
  };

  return (
    <main className="min-h-screen grid place-items-center p-6 text-zinc-200">
      <div className="w-full max-w-md rounded border border-zinc-800 bg-zinc-950 p-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>

        {checking ? (
          <p className="mt-4 text-sm text-zinc-400">Checking session…</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-zinc-400">
              Use your Google account to continue.
            </p>

            {error ? (
              <div className="mt-3 rounded border border-red-800 bg-red-950 p-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6">
              <button
                onClick={signInWithGoogle}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-4 py-2 hover:bg-zinc-800"
                aria-label="Sign in with Google"
                title="Sign in with Google"
              >
                Continue with Google
              </button>
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              You’ll be redirected to Google and then back to the dashboard.
            </p>
          </>
        )}
      </div>
    </main>
  );
}




