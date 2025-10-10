'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '../../../lib/supabaseClient';

type EmailRow = {
  id: string;
  subject: string | null;
  snippet: string | null;
  from_email: string | null;
  suggested_answer: string | null;
};

export default function ReplyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<EmailRow | null>(null);

  const [subject, setSubject] = useState('');
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('emails')
        .select('id,subject,snippet,from_email,suggested_answer')
        .eq('id', params.id)
        .maybeSingle();

      if (error) {
        alert(`Load failed: ${error.message}`);
        router.push('/dashboard');
        return;
      }

      setEmail(data as EmailRow | null);
      setSubject((data?.subject ?? '').trim());
      setTo((data?.from_email ?? '').trim());
      const seed =
        (data?.suggested_answer ?? '').trim() ||
        `Hi,\n\nThanks for reaching out.\n\nBest regards,\n[Your Name]`;
      // Seed body with suggested_answer + original snippet for context
      const built = `${seed}\n\n---- Original message ----\n${data?.snippet ?? ''}`;
      setBody(built);
      setLoading(false);
    };

    load();
  }, [params?.id, router]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(body);
      alert('Draft copied to clipboard.');
    } catch {
      alert('Copy failed. You can still manually select and copy.');
    }
  };

  const mailto = () => {
    const link = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = link;
  };

  if (loading) return <div className="p-6 text-zinc-300">Loading…</div>;
  if (!email) return <div className="p-6 text-zinc-300">Email not found.</div>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Reply</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
        >
          ← Back
        </button>
      </div>

      <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <div>
          <label className="mb-1 block text-xs uppercase text-zinc-400">To</label>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase text-zinc-400">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase text-zinc-400">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={mailto}
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-500"
          >
            Open in email app
          </button>
          <button
            onClick={copyToClipboard}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
          >
            Copy to clipboard
          </button>
        </div>
      </div>
    </div>
  );
}
