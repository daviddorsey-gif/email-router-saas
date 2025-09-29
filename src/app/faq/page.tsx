'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Rule = {
  id: number;
  uuid: string | null;
  pattern: string;
  answer: string;
  is_active: boolean;
  priority: number;
  created_at: string | null;
};

export default function FaqRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [pattern, setPattern] = useState('');
  const [answer, setAnswer] = useState('');
  const [priority, setPriority] = useState<number>(100);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRules() {
    setLoading(true);
    const { data, error } = await supabase
      .from('faq_rules')
      .select('*')
      .order('priority', { ascending: true });

    if (error) {
      setMessage(`Load failed: ${error.message}`);
    } else {
      setRules(data ?? []);
      setMessage(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRules();
  }, []);

  async function addRule() {
    setMessage(null);

    if (!pattern.trim() || !answer.trim()) {
      setMessage('Please provide both a pattern and an answer.');
      return;
    }

    const { error } = await supabase.from('faq_rules').insert([
      {
        pattern: pattern.trim(),
        answer: answer.trim(),
        priority: priority ?? 100,
        is_active: true,
      },
    ]);

    if (error) {
      alert(`Add failed: ${error.message}`);
      return;
    }

    setPattern('');
    setAnswer('');
    setPriority(100);
    await loadRules();
    alert('Rule added');
  }

  async function toggleActive(rule: Rule) {
    const { error } = await supabase
      .from('faq_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);

    if (error) {
      alert(`Update failed: ${error.message}`);
      return;
    }
    await loadRules();
  }

  async function deleteRule(rule: Rule) {
    if (!confirm('Delete this rule?')) return;
    const { error } = await supabase.from('faq_rules').delete().eq('id', rule.id);
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    await loadRules();
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">FAQ Rules</h1>
      <p className="opacity-70 mb-6">
        Add simple keyword/regex patterns and canned answers. These will be used to
        auto-categorize incoming emails.
      </p>

      <section className="mb-8 p-4 rounded border border-black/10 dark:border-white/10">
        <h2 className="font-medium mb-3">Add New Rule</h2>

        <div className="grid gap-3">
          <label className="text-sm opacity-80">
            Pattern (regex or pipe-separated keywords)
          </label>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="px-3 py-2 rounded border border-black/10 dark:border-white/10 bg-transparent"
            placeholder="e.g. hours|support|contact"
          />

          <label className="text-sm opacity-80">Priority (lower = matched first)</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value || '100', 10))}
            className="px-3 py-2 rounded border border-black/10 dark:border-white/10 bg-transparent"
            placeholder="100"
          />

          <label className="text-sm opacity-80">Answer</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="px-3 py-2 rounded border border-black/10 dark:border-white/10 bg-transparent"
            rows={3}
            placeholder="Your canned response…"
          />

          <button
            onClick={addRule}
            className="mt-2 px-4 py-2 rounded border hover:bg-black/5 dark:hover:bg-white/10"
          >
            Add Rule
          </button>

          {message && (
            <div className="text-sm opacity-80 border border-black/10 dark:border-white/10 rounded px-3 py-2">
              {message}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-3">Existing Rules</h2>
        {loading ? (
          <div className="opacity-70">Loading rules…</div>
        ) : rules.length === 0 ? (
          <div className="opacity-70">No rules yet.</div>
        ) : (
          <div className="space-y-3">
            {rules.map((r) => (
              <div
                key={r.id}
                className="p-3 rounded border border-black/10 dark:border-white/10 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="font-mono text-sm break-all">
                    pattern: <span className="opacity-90">{r.pattern}</span>
                  </div>
                  <div className="text-sm opacity-80 mt-1 break-words">
                    answer: {r.answer}
                  </div>
                  <div className="text-xs opacity-60 mt-1">
                    priority: {r.priority} • active: {r.is_active ? 'yes' : 'no'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(r)}
                    className="px-3 py-1 rounded border text-xs hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {r.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => deleteRule(r)}
                    className="px-3 py-1 rounded border text-xs hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
