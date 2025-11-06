// src/components/RuleTester.tsx
'use client';

import React, { useState } from 'react';
import supabase from '../app/lib/supabaseClient';

type MatchResponse = {
  ok: boolean;
  match?: {
    rule: { id: string; pattern: string; answer?: string | null };
    score: number;
  } | null;
  diagnostics?: {
    rulesCount: number;
    patternsSample: string[];
  };
  error?: string;
};

export default function RuleTester({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function runTest() {
    setLoading(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/rules/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ subject, body }),
      });

      const json: MatchResponse = await res.json().catch(() => ({ ok: false, error: 'Invalid JSON' }));
      setResult(json);
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setSubject('');
    setBody('');
    setResult(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[880px] max-w-[95vw] rounded-xl bg-zinc-950 border border-zinc-800 p-6 text-zinc-200 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Rule Tester</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <label className="block text-sm text-zinc-400 mb-1">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject…"
          className="w-full rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm px-3 py-2 mb-3"
        />

        <label className="block text-sm text-zinc-400 mb-1">Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste some email text to test your rules…"
          rows={8}
          className="w-full rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm px-3 py-2"
        />

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={clearAll}
            className="px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm"
            disabled={loading}
          >
            Clear
          </button>
          <button
            onClick={runTest}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm"
            disabled={loading}
          >
            {loading ? 'Testing…' : 'Run Test'}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-5 rounded-md border border-zinc-800 bg-zinc-900 p-3 text-sm space-y-3">
            {/* Diagnostics section */}
            {result.diagnostics && (
              <div className="text-xs text-zinc-400">
                <div>Loaded rules: <span className="text-zinc-200 font-medium">{result.diagnostics.rulesCount}</span></div>
                {result.diagnostics.patternsSample?.length > 0 && (
                  <div className="mt-1">
                    <div className="text-zinc-500">First few patterns:</div>
                    <ul className="list-disc pl-5 mt-1">
                      {result.diagnostics.patternsSample.map((p, i) => (
                        <li key={i} className="text-zinc-300">{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Match section */}
            {result.ok && result.match ? (
              <div>
                <div className="text-zinc-300 mb-2 font-medium">Matched Rule</div>
                <div className="text-zinc-400"><span className="text-zinc-500">ID:</span> {result.match.rule.id}</div>
                <div className="text-zinc-400"><span className="text-zinc-500">Pattern:</span> {result.match.rule.pattern}</div>
                <div className="text-zinc-400"><span className="text-zinc-500">Score:</span> {result.match.score}</div>
                {result.match.rule.answer && (
                  <>
                    <div className="text-zinc-500 mt-3 text-xs">Answer</div>
                    <div className="mt-1 whitespace-pre-wrap text-zinc-200">{result.match.rule.answer}</div>
                  </>
                )}
              </div>
            ) : result.ok && !result.match ? (
              <div className="text-amber-300">No match.</div>
            ) : (
              <div className="text-rose-300">Error: {result.error || 'Unknown error'}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
