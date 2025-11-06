// src/app/api/admin/notify-on-unmatched/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { notifyUnmatchedEmail } from '@/lib/notify';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const emailId = searchParams.get('email_id');
  if (!emailId) {
    return NextResponse.json({ ok: false, error: 'missing_email_id' }, { status: 400 });
  }

  const res = await notifyUnmatchedEmail(emailId, { force: true });
  return NextResponse.json({ ...res, ok: true });
}
