// src/app/api/dev/emails/recent/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
function supa() {
  const url = assertEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = assertEnv('SUPABASE_SERVICE_ROLE');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  const { data, error } = await supa()
    .from('emails')
    .select('id, subject, from_email, mailbox_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, emails: data });
}
