// src/app/api/reply/send/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import nodemailer from '../../../../../lib/nodemailer-shim';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  emailId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

async function requireUser(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || 'true') === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host) throw new Error('SMTP_HOST missing');

  const base: any = { host, port, secure };
  if (user && pass) base.auth = { user, pass };
  return nodemailer.createTransport(base);
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { emailId, to, subject, body } = parsed.data;

  try {
    // 1) Send
    const transporter = createTransporter();
    const fromEmail = process.env.REPLY_FROM_EMAIL || process.env.SMTP_USER || 'no-reply@localhost';
    const fromName = process.env.REPLY_FROM_NAME || 'Support';

    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      text: body,
    });

    // 2) Persist reply (includes subject)
    await supabaseAdmin.from('email_replies').insert({
      email_id: emailId,
      to_address: to,
      subject,
      body,
      sent_at: new Date().toISOString(),
      created_by: user.id,
    });

    // 3) Mark completed
    await supabaseAdmin.from('emails').update({ status: 'completed' }).eq('id', emailId);

    // 4) Rich processing_log entry (keeps audits informative)
    await supabaseAdmin.from('processing_log').insert({
      email_id: emailId,
      action: 'ai',
      result: 'ok',
      message: JSON.stringify({
        type: 'reply_sent',
        to,
        subject,
        length: body.length,
        messageId: info.messageId,
        by: user.email ?? user.id,
      }),
    });

    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (e: any) {
    try {
      await supabaseAdmin.from('processing_log').insert({
        email_id: emailId,
        action: 'ai',
        result: 'error',
        message: String(e?.message || e),
      });
    } catch {}
    return NextResponse.json({ error: e?.message || 'Failed to send' }, { status: 500 });
  }
}
