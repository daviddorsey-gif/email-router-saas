'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient' // keep this relative path

type Email = {
  id: string
  received_at: string
  sender: string | null
  subject: string | null
  snippet: string | null
  category: 'faq' | 'action' | 'review' | null
  status: 'open' | 'completed' | 'error'
}

export default function Dashboard() {
  const [rows, setRows] = useState<Email[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      // ✅ require login
      const { data: sessionData } = await supabase.auth.getSession()
      const email = sessionData?.session?.user?.email ?? null
      if (!email) {
        window.location.href = '/login'
        return
      }
      setUserEmail(email)

      // load latest emails
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(20)

      if (error) setError(error.message)
      else setRows((data ?? []) as Email[])
      setLoading(false)
    }

    void init()
  }, [])

  const refreshRows = async () => {
    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(20)

    if (!error) setRows((data ?? []) as Email[])
  }

  const addTestEmail = async () => {
    const { error } = await supabase.from('emails').insert([
      {
        sender: 'test@app.com',
        subject: 'Local Insert Test',
        snippet: 'Inserted from dashboard',
        category: 'faq',
        status: 'open',
        received_at: new Date().toISOString(),
      },
    ])
    if (error) {
      alert('Insert failed: ' + error.message)
    } else {
      await refreshRows()
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <main style={{ padding: '2rem' }}>
        Loading…
      </main>
    )
  }

  if (error) {
    return (
      <main style={{ padding: '2rem', color: 'tomato' }}>
        Error: {error}
      </main>
    )
  }

  return (
    <main style={{ padding: '2rem' }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl">Emails (latest)</h1>
        <div className="text-sm">
          <span className="mr-3">Signed in as {userEmail}</span>
          <button onClick={signOut} className="px-3 py-1 border rounded">
            Sign out
          </button>
        </div>
      </div>

      <button
        onClick={addTestEmail}
        className="px-3 py-2 border rounded mb-4"
      >
        + Add Test Email
      </button>

      {rows.length === 0 ? (
        <p>No rows yet. Insert one in Supabase and refresh.</p>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">From</th>
              <th className="py-2 pr-4">Subject</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-4">
                  {new Date(r.received_at).toLocaleString()}
                </td>
                <td className="py-2 pr-4">{r.sender ?? '—'}</td>
                <td className="py-2 pr-4">{r.subject ?? '—'}</td>
                <td className="py-2 pr-4">{r.category ?? '—'}</td>
                <td className="py-2 pr-4">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
