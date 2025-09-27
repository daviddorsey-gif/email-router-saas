'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(20)

      if (error) setError(error.message)
      else setRows((data ?? []) as Email[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <main style={{padding:'2rem'}}>Loading…</main>
  if (error)   return <main style={{padding:'2rem', color:'tomato'}}>Error: {error}</main>

  return (
    <main style={{padding:'2rem'}}>
      <h1 className="text-2xl mb-4">Emails (latest)</h1>
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
            {rows.map(r => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-4">{new Date(r.received_at).toLocaleString()}</td>
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
