// src/app/api/diag/log/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/diag/log?secret=some-long-random-string&note=hello&action=rules&result=ok
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret') || '';
    const note = searchParams.get('note') || 'diagnostic';

    // Allowed by your constraints:
    // action: 'rules' | 'ai'
    // result: 'ok' | 'miss' | 'error'
    const action = (searchParams.get('action') || 'rules').trim();
    const result = (searchParams.get('result') || 'ok').trim();

    if (!process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, error: 'CRON_SECRET missing in env' }, { status: 500 });
    }
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('processing_log')
      .insert({
        email_id: null,
        action,     // 'rules' | 'ai'
        result,     // 'ok' | 'miss' | 'error'
        message: note,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
