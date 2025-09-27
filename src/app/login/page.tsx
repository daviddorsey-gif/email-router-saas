'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabaseClient' // your client is in src/app/lib

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signInWithGoogle = async () => {
    try {
      setLoading(true)
      setError(null)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (error) setError(error.message)
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1 className="text-2xl mb-4">Sign in</h1>
      <button
        onClick={signInWithGoogle}
        disabled={loading}
        className="px-4 py-2 rounded border"
      >
        {loading ? 'Redirecting…' : 'Continue with Google'}
      </button>
      {error && <p style={{ color: 'tomato', marginTop: '1rem' }}>Error: {error}</p>}
    </main>
  )
}
