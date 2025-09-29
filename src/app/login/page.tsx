'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type State = 'checking' | 'ready' | 'redirecting';

export default function Login() {
  const [state, setState] = useState<State>('checking');
  const [msg, setMsg] = useState<string | null>(null);
  const timedOut = useRef(false);

  // Helper: session check but never hang forever
  async function checkSessionWithTimeout(ms = 4000) {
    setMsg(null);
    setState('checking');

    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => {
        timedOut.current = true;
        resolve(null);
      }, ms)
    );

    try {
      const sessionPromise = supabase.auth.getSession();
      const raced = await Promise.race([sessionPromise, timeout]);

      // If timeout fired, just show the login button
      if (raced === null) {
        setState('ready');
        return;
      }

      const { data, error } = raced as Awaited<
        ReturnType<typeof supabase.auth.getSession>
      >;

      if (error) {
        console.error('getSession error:', error);
        setMsg(error.message);
        setState('ready');
        return;
      }

      if (data?.session) {
        window.location.href = '/dashboard';
      } else {
        setState('ready');
      }
    } catch (e: any) {
      console.error('getSession threw:', e);
      setMsg(e?.message ?? 'Session check failed.');
      setState('ready');
    }
  }

  useEffect(() => {
    checkSessionWithTimeout();

    // react to auth changes too (e.g., after returning from Google)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        window.location.href = '/dashboard';
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithGoogle() {
    setMsg(null);
    setState('redirecting');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // After OAuth completes, Supabase sends you back here.
        // This page will detect the new session and forward to /dashboard.
        redirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) {
      console.error(error);
      setMsg(error.message);
      setState('ready');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md p-6 rounded-lg border border-black/10 dark:border-white/10">
        <h1 className="text-2xl font-semibold mb-4">Sign in</h1>

        {/* Message / errors */}
        {msg && (
          <div className="mb-3 text-sm px-3 py-2 rounded border border-black/10 dark:border-white/10">
            {msg}
          </div>
        )}

        {/* Checking state (but we’ll still fall back to ready) */}
        {state === 'checking' && (
          <>
            <div className="text-sm opacity-70 mb-3">Checking session…</div>
            {/* Show the button as a fallback too, in case something is slow */}
            <button
              onClick={signInWithGoogle}
              className="w-full px-4 py-2 rounded border hover:bg-black/5 dark:hover:bg-white/10"
            >
              Continue with Google
            </button>
            <button
              onClick={() => checkSessionWithTimeout(0)}
              className="mt-2 w-full text-xs opacity-70 underline"
            >
              It’s taking a while — show the sign-in button anyway
            </button>
          </>
        )}

        {state === 'ready' && (
          <>
            <button
              onClick={signInWithGoogle}
              className="w-full px-4 py-2 rounded border hover:bg-black/5 dark:hover:bg-white/10"
            >
              Continue with Google
            </button>
            <p className="mt-4 text-xs opacity-70">
              After signing in, you’ll return here. We’ll detect your session and send you to the
              dashboard automatically.
            </p>
            <button
              onClick={() => checkSessionWithTimeout()}
              className="mt-3 text-xs opacity-70 underline"
            >
              Re-check session
            </button>
          </>
        )}

        {state === 'redirecting' && (
          <div className="text-sm opacity-70">Redirecting to Google…</div>
        )}
      </div>
    </main>
  );
}


