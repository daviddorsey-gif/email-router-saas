// src/app/dashboard/reply/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import supabase from '../../lib/supabaseClient';

type EmailRow = {
  id: string;
  subject: string | null;
  snippet: string | null;
  from_email: string | null;
  suggested_answer: string | null;
  created_at: string | null;
};

function defaultTemplate(firstName?: string) {
  const name = firstName && firstName.trim().length > 0 ? firstName : 'there';
  return `Hi ${name},

Thanks for reaching out—here’s an update…

Best,
Support Team`;
}

function extractFirstNameFromSnippet(snippet?: string | null): string | undefined {
  if (!snippet) return undefined;
  // Try endings like: "Thanks, David" or "- David"
  const m = snippet.match(/(?:^|\n)[-\s]*(?:thanks|regards|cheers|best)[,]?\s+([A-Z][a-z]+)\s*$/i);
  if (m) return m[1];
  return undefined;
}

function fmt(ts: string | null) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function ReplyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const emailId = params.get('emailId') || '';

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<EmailRow | null>(null);

  // compose fields
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Build quoted original block
  const quotedOriginal = useMemo(() => {
    if (!row) return '';
    const when = fmt(row.created_at);
    const from = row.from_email ?? 'unknown';
    const text = (row.snippet ?? '').trim();
    const header = `On ${when}, ${from} wrote:`;
    const quoted = [header, text]
      .join('\n')
      .split('\n')
      .map((l) => (l.trim().length ? `> ${l}` : '>'))
      .join('\n');
    return quoted;
  }, [row]);

  // Load the email + prefill fields (include quoted original by default)
  useEffect(() => {
    async function run() {
      if (!emailId) {
        alert('Missing emailId.');
        router.push('/dashboard');
        return;
      }
      const { data, error } = await supabase
        .from('emails')
        .select('id, subject, snippet, from_email, suggested_answer, created_at')
        .eq('id', emailId)
        .maybeSingle();

      if (error || !data) {
        alert(error?.message || 'Email not found');
        router.push('/dashboard');
        return;
      }

      const rec = data as EmailRow;
      setRow(rec);
      setTo(rec.from_email ?? '');
      setSubject(`Re: ${rec.subject ?? ''}`.trim());

      const guessed = extractFirstNameFromSnippet(rec.snippet);
      const base = rec.suggested_answer?.trim()?.length
        ? rec.suggested_answer!
        : defaultTemplate(guessed);

      const withQuote = quotedOriginal ? `${base}\n\n${quotedOriginal}` : base;
      setBody(withQuote);

      setLoading(false);
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailId, router]); // (quotedOriginal derives from row, which is set inside)

  async function onSend() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert('Please sign in again.');
        return;
      }

      const payload = { emailId, to, subject, body };

      const res = await fetch('/api/reply/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Send failed: ${json?.error || res.statusText}`);
        return;
      }

      alert('Reply sent!');
      router.push('/dashboard');
    } catch (e: any) {
      alert(e?.message || 'Unexpected error');
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/60 text-zinc-200">
        Loading…
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[980px] max-w-[95vw] rounded-xl bg-zinc-950 border border-zinc-800 p-6 text-zinc-200 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Reply</h2>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-zinc-400 hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Original message panel */}
        <div className="mb-5 rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="px-4 py-3 border-b border-zinc-800 text-sm text-zinc-400 flex flex-wrap gap-x-6 gap-y-1">
            <div><span className="text-zinc-500">From:</span> <span className="text-zinc-200">{row?.from_email ?? 'unknown'}</span></div>
            <div className="truncate"><span className="text-zinc-500">Subject:</span> <span className="text-zinc-200">{row?.subject ?? '(no subject)'}</span></div>
            <div><span className="text-zinc-500">Received:</span> <span className="text-zinc-200">{fmt(row?.created_at ?? null)}</span></div>
          </div>
          <div className="px-4 py-3 text-sm text-zinc-300 whitespace-pre-wrap">
            {row?.snippet || '(no body)'}
          </div>
        </div>

        {/* Compose form */}
        <div className="space-y-3">
          <div>
            <div className="text-sm text-zinc-400 mb-1">To</div>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm px-3 py-2"
              placeholder="recipient@example.com"
            />
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-1">Subject</div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm px-3 py-2"
              placeholder="Re: …"
            />
          </div>

          <div>
            <div className="text-sm text-zinc-400 mb-1">Message</div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className="w-full rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onSend}
            className="px-3 py-1.5 rounded-md bg-[#1B7298] hover:brightness-110 text-white text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
