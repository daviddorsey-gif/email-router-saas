'use client';

import { useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';

type LogRow = {
  id: string;
  email_id: string;
  action: 'rules'|'ai';
  result: 'ok'|'miss'|'error';
  message: string | null;
  created_at: string;
};

export default function LogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('processing_log')
        .select('id, email_id, action, result, message, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && data) setRows(data as LogRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-6 text-sm">
      <h1 className="text-2xl mb-4">Processing Logs</h1>
      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div>No logs yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="border border-zinc-700 rounded p-3">
              <div className="flex gap-3 items-center">
                <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-600">{r.action}</span>
                <span className={`px-2 py-0.5 rounded ${r.result === 'ok' ? 'bg-green-900 border border-green-700' : r.result === 'miss' ? 'bg-amber-900 border border-amber-700' : 'bg-red-900 border border-red-700'}`}>
                  {r.result}
                </span>
                <span className="text-zinc-400">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-zinc-300">email_id: {r.email_id}</div>
              {r.message && <div className="text-zinc-200 mt-1">msg: {r.message}</div>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
