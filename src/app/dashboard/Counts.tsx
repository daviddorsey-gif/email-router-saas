// src/app/dashboard/Counts.tsx
'use client';

import { useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';

type Counts = {
  autoToday: number;
  unmatched: number;
  errors: number;
};

export default function Counts() {
  const [counts, setCounts] = useState<Counts>({ autoToday: 0, unmatched: 0, errors: 0 });

  useEffect(() => {
    const load = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Auto processed (today)
      const { count: autoToday } = await supabase
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .gte('auto_processed_at', today.toISOString());

      // Unmatched: open & suggested_answer is null
      const { count: unmatched } = await supabase
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
        .is('suggested_answer', null);

      // Errors (if you use status='error'; otherwise adjust)
      const { count: errors } = await supabase
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'error');

      setCounts({
        autoToday: autoToday ?? 0,
        unmatched: unmatched ?? 0,
        errors: errors ?? 0,
      });
    };

    load();
  }, []);

  return (
    <div className="mb-4 flex gap-2 flex-wrap">
      <Badge label="Auto (today)" value={counts.autoToday} color="emerald" />
      <Badge label="Unmatched" value={counts.unmatched} color="yellow" />
      <Badge label="Errors" value={counts.errors} color="rose" />
    </div>
  );
}

function Badge({ label, value, color }: { label: string; value: number; color: 'emerald'|'yellow'|'rose' }) {
  const colors: Record<string,string> = {
    emerald: 'bg-emerald-900/40 text-emerald-300',
    yellow: 'bg-yellow-900/40 text-yellow-300',
    rose:   'bg-rose-900/40 text-rose-300',
  };
  return (
    <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${colors[color]}`}>
      <span className="mr-2">{label}</span>
      <span className="rounded bg-black/30 px-2 py-0.5 font-mono">{value}</span>
    </div>
  );
}
