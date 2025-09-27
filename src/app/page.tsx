'use client'

import { useEffect } from 'react'
import { supabase } from './lib/supabaseClient' // relative to src/app

export default function Home() {
  useEffect(() => {
    const go = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        window.location.href = '/dashboard'
      } else {
        window.location.href = '/login'
      }
    }
    void go()
  }, [])

  return <main style={{ padding: '2rem' }}>Redirecting…</main>
}
