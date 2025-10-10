'use client';

import React, { useEffect, useMemo, useState } from 'react';
// Adjust this path if your client lives elsewhere
import supabase from '../lib/supabaseClient';

//
// ---------- Types ----------
//

export type EmailRow = {
  id: string;
  subject: string | null;
  snippet: string | null;
  from_email: string | null;
  category: string | null;
  status: 'open' | 'completed' | 'error' | string;
  matched_rule_id: string | null;
  suggested_answer: string | null;
  auto_processed_at: string | null; // timestamptz
  created_at: string | null;        // timestamptz
};

type EmailCardProps = {
  email: EmailRow;
  onComplete: () => void;
  onReRun: () => void;
  onReply: () => void;
};

//
// ---------- Small helpers ----------
//

function fmt(ts: string | null) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

//
// ---------- Card ----------
//

function EmailCard({ email, onComplete, onReRun, onReply }: EmailCardProps) {
  // 5b) “Saved at” — prefer auto_processed_at, otherwise created_at to track timing.
  const savedTs = email.auto_processed_at ?? email.created_at;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-zinc-200 font-medium">{email.subject ?? '(no subject)'}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs rounded-full px-2 py-0.5 bg-zinc-800 text-zinc-300">
            {email.status ?? 'open'}
          </span>
          {email.auto_processed_at && (
            <span className="text-xs rounded-full px-2 py-0.5 bg-emerald-900/40 text-emerald-300">
              auto
            </span>
          )}
        </div>
      </div>

      <div className="text-zinc-400 text-sm mt-1">From: {email.from_email ?? 'unknown'}</div>
      <div className="text-zinc-500 text-xs mt-1">{fmt(email.created_at)}</div>

      {email.snippet && (
        <div className="text-zinc-300 mt-3">{email.snippet}</div>
      )}

      {email.suggested_answer && (
        <>
          <div className="text-xs text-zinc-500 mt-4">SUGGESTED</div>
          <div className="mt-2 rounded-md bg-zinc-900 border border-zinc-800 p-3 text-zinc-200 whitespace-pre-wrap">
            {email.suggested_answer}
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onComplete}
            className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
          >
            ✓ Complete
          </button>
          <button
            onClick={onReRun}
            className="px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm"
          >
            Re-run Match
          </button>
          <button
            onClick={onReply}
            className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-sm"
          >
            Reply
          </button>
        </div>

        {/* NEW: Saved at timestamp */}
        {savedTs && (
          <div className="text-xs text-zinc-500 ml-auto">
            Saved at {fmt(savedTs)}
          </div>
        )}
      </div>
    </div>
  );
}

//
// ---------- Page ----------
//

export default function DashboardPage() {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(false);

  // counters
  const [openCount, setOpenCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  // top summary
  const [autoToday, setAutoToday] = useState(0);
  const [unmatched, setUnmatched] = useState(0);
  const [errTop, setErrTop] = useState(0);

  // filters/search
  const [tab, setTab] = useState<'open' | 'completed' | 'error' | 'all'>('open');
  const [category, setCategory] = useState<'All' | 'faq'>('All');
  const [query, setQuery] = useState('');

  // session banner
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setUserEmail(data?.session?.user?.email ?? '');
    })();
  }, []);

  useEffect(() => {
    void loadAll();
  }, [tab, category, query]);

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadEmails(), loadCounts(), loadTopSummary()]);
    } finally {
      setLoading(false);
    }
  }

  // ---- load main list
  async function loadEmails() {
    let q = supabase
      .from('emails')
      .select(
        `id, subject, snippet, from_email, category, status, matched_rule_id, suggested_answer, auto_processed_at, created_at`
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (tab !== 'all') q = q.eq('status', tab);
    if (category !== 'All') q = q.eq('category', category.toLowerCase());
    if (query.trim()) {
      q = q.or(
        `subject.ilike.%${query.trim()}%,snippet.ilike.%${query.trim()}%`
      );
    }

    const { data, error } = await q;
    if (error) {
      alert(`Load failed: ${error.message}`);
      setEmails([]);
      return;
    }
    setEmails((data ?? []) as EmailRow[]);
  }

  // ---- bottom pills counts
  async function loadCounts() {
    // open
    {
      const { count } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      setOpenCount(count ?? 0);
    }
    // completed
    {
      const { count } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
      setCompletedCount(count ?? 0);
    }
    // error
    {
      const { count } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error');
      setErrorCount(count ?? 0);
    }
  }

  // ---- top summary counters
  async function loadTopSummary() {
    // Auto (today): auto_processed_at is today
    {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .not('auto_processed_at', 'is', null)
        .gte('auto_processed_at', start.toISOString());
      setAutoToday(count ?? 0);
    }

    // Unmatched: status=open AND matched_rule_id is null
    {
      const { count } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .is('matched_rule_id', null);
      setUnmatched(count ?? 0);
    }

    // Errors (same as errorCount)
    {
      const { count } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error');
      setErrTop(count ?? 0);
    }
  }

  // ---- actions
  async function markStatus(row: EmailRow, status: 'completed' | 'error' | 'open') {
    const { error } = await supabase.from('emails').update({ status }).eq('id', row.id);
    if (error) {
      alert(`Update failed: ${error.message}`);
      return;
    }
    await loadAll();
  }

  async function reRunMatch(row: EmailRow) {
    // If you have an RPC, call it here; otherwise clear matched_rule_id to let triggers reconsider.
    const { error } = await supabase
      .from('emails')
      .update({ matched_rule_id: null })
      .eq('id', row.id);
    if (error) {
      alert(`Re-run failed: ${error.message}`);
      return;
    }
    await loadAll();
  }

  function reply(row: EmailRow) {
    window.location.href = `/dashboard/reply?emailId=${encodeURIComponent(row.id)}`;
  }

  // ---- Add Test Email (prompt-based; no hard-coding)
  async function addTestEmail() {
    const subject = window.prompt('Subject?', 'Need refund');
    if (subject == null) return;
    const snippet = window.prompt('Snippet?', 'Can I get a refund for a missed class?') ?? '';
    const fromEmail = window.prompt('From email?', 'test@app.com') ?? 'test@app.com';

    const payload = {
      subject,
      snippet,
      from_email: fromEmail,
      status: 'open' as const,
      category: 'faq' as const,
    };

    const { error } = await supabase.from('emails').insert(payload);
    if (error) {
      alert(`Insert failed: ${error.message}`);
      return;
    }
    await loadAll();
  }

  // ---- final list
  const filtered = useMemo(() => emails, [emails]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Emails</h1>
        <div className="flex items-center gap-3">
          <div className="text-zinc-400">
            Signed in as: <span className="text-zinc-200">{userEmail || '...'}</span>
          </div>
          <button
            onClick={addTestEmail}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            + Add Test Email
          </button>
          <button
            onClick={() => supabase.auth.signOut().then(() => (window.location.href = '/login'))}
            className="px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Top summary */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Pill label="Auto (today)" count={autoToday} color="emerald" />
        <Pill label="Unmatched" count={unmatched} color="amber" />
        <Pill label="Errors" count={errTop} color="rose" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Tab active={tab === 'open'} onClick={() => setTab('open')} label="Open" count={openCount} />
        <Tab
          active={tab === 'completed'}
          onClick={() => setTab('completed')}
          label="Completed"
          count={completedCount}
        />
        <Tab active={tab === 'error'} onClick={() => setTab('error')} label="Error" count={errorCount} />
        <Tab active={tab === 'all'} onClick={() => setTab('all')} label="All" count={openCount + completedCount + errorCount} />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as 'All' | 'faq')}
          className="ml-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm px-2 py-1"
        >
          <option>All</option>
          <option>faq</option>
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject or snippet..."
            className="w-72 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm px-3 py-1.5"
          />
          <button
            onClick={() => void loadAll()}
            className="px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm"
          >
            Search
          </button>
        </div>
      </div>

      {/* List */}
      {loading && <div className="text-zinc-400 text-sm mb-3">Loading…</div>}

      <div className="space-y-4">
        {filtered.map((e: EmailRow) => (
          <EmailCard
            key={e.id}
            email={e}
            onComplete={() => markStatus(e, 'completed')}
            onReRun={() => reRunMatch(e)}
            onReply={() => reply(e)}
          />
        ))}
        {!loading && filtered.length === 0 && (
          <div className="text-zinc-500 text-sm">No emails match your filter.</div>
        )}
      </div>
    </div>
  );
}

//
// ---------- Tiny UI bits ----------
//

function Pill({ label, count, color }: { label: string; count: number; color: 'emerald' | 'amber' | 'rose' }) {
  const base = 'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm';
  const palette: Record<'emerald' | 'amber' | 'rose', string> = {
    emerald: 'bg-emerald-900/40 text-emerald-300',
    amber: 'bg-amber-900/40 text-amber-300',
    rose: 'bg-rose-900/40 text-rose-300',
  };
  return (
    <div className={`${base} ${palette[color]}`}>
      <span>{label}</span>
      <span className="rounded-full px-1.5 bg-black/30">{count}</span>
    </div>
  );
}

function Tab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-zinc-900 text-zinc-200 border border-zinc-800 hover:bg-zinc-800'
      }`}
    >
      {label} ({count})
    </button>
  );
}
