'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Email = {
  id: string;
  sender: string | null;
  subject: string | null;
  snippet: string | null;
  category: 'faq' | 'action' | 'review' | null;
  status: 'open' | 'completed' | 'error';
  received_at: string;
};

const STATUS = ['all', 'open', 'completed', 'error'] as const;
const CATEGORY = ['all', 'faq', 'action', 'review'] as const;

export default function Dashboard() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS)[number]>('all');
  const [categoryFilter, setCategoryFilter] =
    useState<(typeof CATEGORY)[number]>('all');
  const [search, setSearch] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  // --- Auth bootstrap
  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) console.error('Auth getUser error:', error);

      if (!user) {
        window.location.href = '/login';
        return;
      }

      setUserEmail(user.email ?? null);
      await fetchRows();
      setLoading(false);

      const { data: listener } = supabase.auth.onAuthStateChange(
        async (_evt, session) => {
          const email = session?.user?.email ?? null;
          setUserEmail(email);
          if (!email) {
            window.location.href = '/login';
            return;
          }
          await fetchRows();
        }
      );
      unsub = () => listener.subscription.unsubscribe();
    })();

    return () => {
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when filters/search change
  useEffect(() => {
    if (!userEmail) return;
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, search, userEmail]);

  const fetchRows = async () => {
    setMsg(null);

    let q = supabase
      .from('emails')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(200);

    // We apply category/search in the DB query; status is handled by pills locally
    if (categoryFilter !== 'all') q = q.eq('category', categoryFilter);
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      q = q.or(`subject.ilike.${term},snippet.ilike.${term}`);
    }

    const { data, error } = await q;
    if (error) {
      console.error('Fetch error:', error);
      setMsg(`Fetch failed: ${error.message}`);
      return;
    }

    setEmails((data ?? []) as Email[]);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // Update a single row’s status
  const updateStatus = async (id: string, next: Email['status']) => {
    setMsg(null);
    setWorkingId(id);

    const { error } = await supabase.from('emails').update({ status: next }).eq('id', id);

    if (error) {
      console.error('Update error:', error);
      setMsg(`Update failed: ${error.message}`);
      setWorkingId(null);
      return;
    }

    setEmails(prev => prev.map(e => (e.id === id ? { ...e, status: next } : e)));
    setMsg(`Marked ${next}`);
    setWorkingId(null);
  };

  // Base set that category + search filtered (matches what we fetched)
  const base = emails;

  // Counts used by pills (status counts within current category+search context)
  const counts = {
    all: base.length,
    open: base.filter(e => e.status === 'open').length,
    completed: base.filter(e => e.status === 'completed').length,
    error: base.filter(e => e.status === 'error').length,
  };

  // Apply status filter for the final list
  const filteredEmails =
    statusFilter === 'all' ? base : base.filter(e => e.status === statusFilter);

  if (loading) {
    return (
      <main className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-7 w-48 bg-black/10 dark:bg-white/10 rounded" />
          <div className="h-24 w-full bg-black/5 dark:bg-white/5 rounded" />
          <div className="h-24 w-full bg-black/5 dark:bg-white/5 rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Emails</h1>
          <p className="text-sm text-gray-500">Latest incoming messages</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {userEmail ? `Signed in as ${userEmail}` : 'Signed in'}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="px-3 py-1.5 border rounded text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className="mb-3 text-sm px-3 py-2 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800">
          {msg}
        </div>
      )}

      {/* Controls: Pills (status) + Category + Search + Reset */}
      <div className="flex flex-col gap-3 mb-5">
        {/* Status pills */}
        <div className="flex flex-wrap gap-2">
          {(STATUS as readonly string[]).map((s) => {
            const selected = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s as (typeof STATUS)[number])}
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  selected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-transparent text-gray-200 border-gray-600 hover:bg-white/10'
                }`}
                title={`Show ${s}`}
              >
                {s[0].toUpperCase() + s.slice(1)}{' '}
                <span className="opacity-80">({counts[s as keyof typeof counts]})</span>
              </button>
            );
          })}
        </div>

        {/* Category + Search */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as (typeof CATEGORY)[number])
              }
              className="border rounded px-2 py-1 text-sm bg-white text-black border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-white/20"
            >
              {CATEGORY.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject or snippet…"
              className="border rounded px-3 py-1.5 text-sm w-full sm:w-80 bg-white text-black border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-white/20"
            />
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setSearch('');
              }}
              className="px-3 py-1.5 border rounded text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filteredEmails.length === 0 && (
        <div className="border rounded-xl p-8 text-center text-gray-600">
          <div className="text-lg mb-2">No emails match your filters</div>
          <div className="text-sm">Try changing filters or clearing search.</div>
        </div>
      )}

      {/* List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredEmails.map((e) => (
          <article
            key={e.id}
            className="rounded-xl border p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-medium truncate">{e.subject ?? '—'}</h2>
                  <Badge color={statusColor(e.status)}>{e.status}</Badge>
                  {e.category && <Badge color="slate">{e.category}</Badge>}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  From: <span className="font-mono">{e.sender ?? '—'}</span>
                </p>
              </div>

              <div className="flex flex-col items-end gap-2 whitespace-nowrap">
                <div className="text-xs text-gray-500">
                  {new Date(e.received_at).toLocaleString()}
                </div>

                <div className="flex gap-2">
                  {e.status !== 'completed' ? (
                    <button
                      type="button"
                      disabled={workingId === e.id}
                      onClick={() => updateStatus(e.id, 'completed')}
                      className="px-2 py-1 text-xs rounded border hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                      title="Mark as completed"
                    >
                      {workingId === e.id ? 'Saving…' : '✅ Complete'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={workingId === e.id}
                      onClick={() => updateStatus(e.id, 'open')}
                      className="px-2 py-1 text-xs rounded border hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                      title="Reopen"
                    >
                      {workingId === e.id ? 'Saving…' : '↩ Reopen'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {e.snippet && (
              <p className="text-sm mt-3 text-gray-700 dark:text-gray-300">
                {e.snippet}
              </p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}

/** Badge pill */
function Badge({
  children,
  color = 'slate',
}: {
  children: React.ReactNode;
  color?: 'slate' | 'green' | 'amber' | 'red';
}) {
  const styles: Record<string, string> = {
    slate:
      'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200 border border-gray-200 dark:border-white/10',
    green:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200/70 dark:border-green-800/60',
    amber:
      'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60',
    red:
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200/70 dark:border-red-800/60',
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full ${styles[color]}`}>
      {children}
    </span>
  );
}

function statusColor(status: Email['status']): 'slate' | 'green' | 'amber' | 'red' {
  if (status === 'completed') return 'green';
  if (status === 'open') return 'amber';
  if (status === 'error') return 'red';
  return 'slate';
}
