// src/app/api/reply/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    const { emailId, to, subject, body } = await req.json();

    if (!emailId || !body) {
      return NextResponse.json(
        { ok: false, error: 'emailId and body are required' },
        { status: 400 }
      );
    }

    // 1) Save reply to outbox (provider=log for now)
    const { error: insertErr } = await admin.from('email_outbox').insert({
      email_id: emailId,
      to_email: to ?? null,
      subject: subject ?? null,
      body,
      status: 'sent',
      provider: 'log',
    });

    if (insertErr) {
      return NextResponse.json(
        { ok: false, error: `Insert failed: ${insertErr.message}` },
        { status: 400 }
      );
    }

    // 2) Mark email as completed
    const { error: updateErr } = await admin
      .from('emails')
      .update({ status: 'completed' })
      .eq('id', emailId);

    if (updateErr) {
      return NextResponse.json(
        { ok: false, error: `Update failed: ${updateErr.message}` },
        { status: 400 }
      );
    }

    // 3) Log it (best-effort)
    await admin.from('processing_log').insert({
      action: 'reply',
      result: 'ok',
      email_id: emailId,
      message: 'Reply saved & email marked completed (provider=log)',
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Unexpected error' },
      { status: 500 }
    );
  }
}
