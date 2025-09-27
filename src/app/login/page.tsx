'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient' // client is in src/app/lib

export default function Login() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        // already signed in → go to dashboard
        window.location.href = '/dashboard'
        return
      }
      setLoading(false)
    }

    init()

    // redirect on future sign-ins
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) window.location.href = '/dashboard'
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
  }

  if (loading) return <main style={{ padding: '2rem' }}>Loading…</main>

  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 className="text-2xl mb-4">Login</h1>
      <button
        onClick={signInWithGoogle}
        className="px-4 py-2 rounded border"
      >
        Continue with Google
      </button>
    </main>
  )
}


