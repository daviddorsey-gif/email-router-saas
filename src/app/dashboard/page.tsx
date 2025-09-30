'use client';

import { useEffect, useMemo, useState } from 'react';
import supabase from '../lib/supabaseClient';

type EmailRow = {
  id: string;
  received_at: string | null;
  created_at: string | null;
  from_email: string | null;
  sender: string | null;
  subject: string | null;
  snippet: string | null;
  category: string | null;
  status: 'open' | 'completed' | 'error' | string | null;
  matched_rule_id: string | null;
  suggested_answer: string | null;
  auto_tag: boolean | null;
};

// Type used specifically when inserting a new email row
type EmailInsert = {
  from_email: string;
  sender: string | null;
  subject: string | null;
  snippet: string | null;
  status: 'open' | 'completed' | 'error';
  received_at: string;
  category?: string | null;
  // You can include optional columns here if you want to seed them
  // matched_rule_id?: string | null;
  // suggested_answer?: string | null;
  // auto_tag?: boolean | null;
};

export default function DashboardPage() {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // UI filters
  const [filterCategory, setFilterCategory] = useState<'All' | 'faq' | 'other'>('All');
  const [search, setSearch] = useState('');

  // ---- Load session user
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email ?? null;
      setUserEmail(email);
    })();
  }, []);

  // ---- Load emails
  const loadEmails = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from('emails')
        .select(
          `
          id, received_at, created_at,
          from_email, sender,
          subject, snippet,
          category, status,
          matched_rule_id, suggested_answer, auto_tag
        `
        )
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setEmails(data ?? []);
    } catch (err: any) {
      console.error('Load failed:', err);
      setMsg(`Load failed: ${err?.message ?? 'Unknown error'}`);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  // ---- Derived counts for pills
  const counts = useMemo(() => {
    const all = emails.length;
    const open = emails.filter((e) => e.status === 'open').length;
    const completed = emails.filter((e) => e.status === 'completed').length;
    const error = emails.filter((e) => e.status === 'error').length;
    return { all, open, completed, error };
  }, [emails]);

  // ---- Client filtering
  const filtered = useMemo(() => {
    return emails.filter((e) => {
      const matchesCategory =
        filterCategory === 'All'
          ? true
          : filterCategory === 'faq'
          ? (e.category ?? '').toLowerCase() === 'faq'
          : (e.category ?? '').toLowerCase() !== 'faq';

      const hay = `${e.subject ?? ''} ${e.snippet ?? ''}`.toLowerCase();
      const matchesSearch = hay.includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [emails, filterCategory, search]);

  // ---- Update status helper (complete / reopen)
  const markStatus = async (id: string, status: 'open' | 'completed') => {
    try {
      const { error } = await supabase.from('emails').update({ status }).eq('id', id);
      if (error) {
        console.error('Update failed:', error);
        alert(`Update failed: ${error.message ?? 'Unknown error'}`);
        return;
      }
      setMsg(status === 'completed' ? 'Marked completed' : 'Reopened');
      await loadEmails();
    } catch (err) {
      console.error(err);
      alert('Unexpected error while updating status.');
    }
  };

  // ---- Insert a controllable test email (prompts) — typed payload
  const addTestEmail = async () => {
    try {
      const subject = window.prompt('Subject for the test email?', 'Invoice available');
      if (subject === null) return;

      const snippet = window.prompt(
        'Snippet / short body preview?',
        "Thanks for joining! Here's what to do next..."
      );
      if (snippet === null) return;

      const from_email = window.prompt('From email (optional):', 'test@app.com') || 'test@app.com';

      const payload: EmailInsert = {
        subject,
        snippet,
        from_email,
        sender: from_email,
        status: 'open',
        received_at: new Date().toISOString(),
        // category: 'faq', // set if you want seeded category
      };

      // Insert one test row (typed) – no TS warning
      const { error } = await supabase.from('emails').insert<EmailInsert>(payload);
      if (error) {
        console.error('insert email error:', error);
        alert(`Add failed: ${error.message ?? 'Unknown error'}`);
        return;
      }

      setMsg('Test email added.');
      await loadEmails();
    } catch (err) {
      console.error(err);
      alert('Unexpected error adding test email.');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <main className="p-6 text-zinc-200">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Emails</h1>

        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">
            {userEmail ? `Signed in as ${userEmail}` : 'Signed in'}
          </span>
          <button
            onClick={addTestEmail}
            className="rounded border border-zinc-700 px-3 py-2 hover:bg-zinc-800"
          >
            + Add Test Email
          </button>
          <button
            onClick={signOut}
            className="rounded border border-zinc-700 px-3 py-2 hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill label={`All (${counts.all})`} active />
        <Pill label={`Open (${counts.open})`} />
        <Pill label={`Completed (${counts.completed})`} />
        <Pill label={`Error (${counts.error})`} />
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Category</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
            title="Filter by category"
          >
            <option>All</option>
            <option value="faq">faq</option>
            <option value="other">other</option>
          </select>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subject or snippet…"
          className="flex-1 min-w-[280px] rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
        />

        <button
          onClick={() => {
            setFilterCategory('All');
            setSearch('');
          }}
          className="rounded border border-zinc-700 px-3 py-2 hover:bg-zinc-800"
        >
          Reset
        </button>
      </div>

      {/* Messages */}
      {msg ? (
        <div className="mb-4 rounded border border-zinc-700 bg-zinc-900 p-3 text-sm">{msg}</div>
      ) : null}

      {/* Loading */}
      {loading && <div className="text-sm text-zinc-400">Loading…</div>}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="text-sm text-zinc-400">No emails match your filter.</div>
      )}

      {/* List */}
      <div className="flex flex-col gap-4">
        {filtered.map((email) => {
          const when = email.received_at ?? email.created_at ?? null;
          const whenStr = when ? new Date(when).toLocaleString() : '';

          const from = email.from_email ?? email.sender ?? 'unknown';

          return (
            <div key={email.id} className="rounded border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-medium truncate">
                    {email.subject ?? '(no subject)'}
                  </div>
                  <div className="text-sm text-zinc-400">From: {from}</div>
                </div>

                <div className="text-xs text-zinc-400 shrink-0">{whenStr}</div>
              </div>

              <div className="mt-2 text-sm text-zinc-200">{email.snippet ?? ''}</div>

              {/* Category / Status badges */}
              <div className="mt-2 flex items-center gap-2">
                {email.category ? (
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    {email.category}
                  </span>
                ) : null}
                {email.status ? (
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    {email.status}
                  </span>
                ) : null}
              </div>

              {/* Suggested Answer card */}
              {email.suggested_answer ? (
                <div className="mt-3 rounded border border-zinc-700 bg-zinc-900 p-3">
                  <div className="text-zinc-200 text-sm whitespace-pre-wrap">
                    {email.suggested_answer}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={async () => {
                        const { error } = await supabase
                          .from('emails')
                          .update({ status: 'completed' })
                          .eq('id', email.id);
                        if (error) {
                          console.error('Update failed:', error);
                          alert(`Update failed: ${error.message ?? 'Unknown error'}`);
                          return;
                        }
                        setMsg('Marked completed');
                        await loadEmails();
                      }}
                      className="px-3 py-1 text-sm rounded bg-emerald-700 hover:bg-emerald-600"
                    >
                      Accept & Complete
                    </button>

                    <button
                      onClick={async () => {
                        const { error } = await supabase
                          .from('emails')
                          .update({
                            suggested_answer: null,
                            matched_rule_id: null,
                            auto_tag: false,
                          })
                          .eq('id', email.id);
                        if (error) {
                          console.error('Dismiss failed:', error);
                          alert(`Dismiss failed: ${error.message ?? 'Unknown error'}`);
                          return;
                        }
                        setMsg('Suggestion dismissed');
                        await loadEmails();
                      }}
                      className="px-3 py-1 text-sm rounded border border-zinc-600 hover:bg-zinc-800"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                {email.status === 'open' ? (
                  <button
                    onClick={() => markStatus(email.id, 'completed')}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 hover:bg-zinc-800"
                  >
                    ✅ Complete
                  </button>
                ) : (
                  <button
                    onClick={() => markStatus(email.id, 'open')}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 hover:bg-zinc-800"
                  >
                    ♻ Reopen
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function Pill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm border ${
        active ? 'bg-zinc-800' : 'bg-zinc-900'
      } border-zinc-700`}
    >
      {label}
    </span>
  );
}
