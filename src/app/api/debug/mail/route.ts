// src/app/api/debug/mail/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';

export async function GET() {
  const res = await sendMail({
    to: process.env.NOTIFY_TO_EMAIL || 'owner@dev.local',
    from: { name: 'Dev Notifier', address: 'notify@dev.local' },
    subject: 'Mailer smoke test',
    html: '<p>This is a test from the debug route.</p>',
  });
  return NextResponse.json({ ok: true, res });
}
