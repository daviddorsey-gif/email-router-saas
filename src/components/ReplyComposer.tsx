// src/components/ReplyComposer.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import supabase from '../app/lib/supabaseClient'; // your working path

type EmailRow = {
  id: string;
  from_email: string;
  subject: string;
  message_id?: string | null;
  references?: string[] | null;
};

type Props = {
  email: EmailRow;
  onSent?: () => void;
  triggerClassName?: string;
};

function nameFromEmail(email: string) {
  const [local] = email.split('@');
  const base = (local || '').replace(/[._-]+/g, ' ').trim();
  if (!base) return 'there';
  const first = base.split(' ')[0];
  return first ? first[0].toUpperCase() + first.slice(1) : 'there';
}

export default function ReplyComposer({ email, onSent, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingFill, setLoadingFill] = useState(false);

  const [subject, setSubject] = useState(() =>
    email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject}`
  );
  const defaultGreeting = useMemo(() => `Hi ${nameFromEmail(email.from_email)},`, [email.from_email]);
  const [body, setBody] = useState(
    `${defaultGreeting}\n\nThanks for reaching out—here’s an update...\n\nBest,\nSupport Team`
  );

  // Auto-fill from rules/render when opened
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoadingFill(true);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch('/api/rules/render', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ emailId: email.id }),
        });

        let json: any = null;
        try { json = await res.json(); } catch {}
        if (res.ok && json?.ok) {
          if (json.subject) setSubject(json.subject);
          if (json.body) setBody(json.body);
        }
      } catch {
        // keep defaults
      } finally {
        setLoadingFill(false);
      }
    })();
  }, [open, email.id]);

  async function send() {
    setSending(true);
    setError(null);
    try {
      // 🔑 Get token and include it
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Please sign in again.');

      const res = await fetch('/api/reply/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // <-- fixes Unauthorized
        },
        body: JSON.stringify({
          emailId: email.id,
          to: email.from_email,
          subject,
          body: body.replace(/\n/g, '<br/>'),
          inReplyTo: email.message_id || undefined,
          references: email.references || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to send reply');
      onSent?.();
      setOpen(false);
    } catch (e: any) {
      setError(e.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        className={
          triggerClassName ||
          'px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm'
        }
        onClick={() => setOpen(true)}
        aria-label={`Reply to ${email.from_email}`}
      >
        Reply
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-xl bg-zinc-900 text-zinc-100 border border-zinc-800 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h2 className="text-lg font-semibold">Reply</h2>
              <button
                className="text-zinc-400 hover:text-zinc-200"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div className="text-sm">
                <div className="text-zinc-400">To:</div>
                <div className="mt-1 text-zinc-200">{email.from_email}</div>
              </div>

              <div className="text-sm">
                <label htmlFor="reply-subject" className="block text-zinc-400 mb-1">
                  Subject {loadingFill && <span className="text-xs text-zinc-500">(loading…)</span>}
                </label>
                <input
                  id="reply-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-md bg-zinc-900 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-600 px-2 py-2 text-zinc-100 placeholder-zinc-500"
                  placeholder="Subject"
                />
              </div>

              <div className="text-sm">
                <label htmlFor="reply-body" className="block text-zinc-400 mb-1">
                  Message {loadingFill && <span className="text-xs text-zinc-500">(loading…)</span>}
                </label>
                <textarea
                  id="reply-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="w-full rounded-md bg-zinc-900 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-600 px-3 py-2 text-zinc-100 font-mono text-sm placeholder-zinc-500"
                  placeholder="Write your message…"
                />
              </div>

              {error && <div className="text-sm text-rose-400">{error}</div>}
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
              <button
                className="px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm"
                onClick={() => setOpen(false)}
                disabled={sending}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-60"
                onClick={send}
                disabled={sending}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
