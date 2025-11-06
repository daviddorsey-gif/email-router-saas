// src/app/api/admin/preview-match/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { withUnsubscribeFooter } from '@/libs/email/render';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  email_id: z.string().uuid(),
  dryrun: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === '1' || v === 1 ? true : false)),
});

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return ch;
    }
  });
}

type EmailRow = {
  id: string;
  to_email: string | null;
  from_email: string | null;
  subject: string | null;
  html_body: string | null;
  text_body: string | null;
  mailbox_id: string | null;
};

async function getEmailById(emailId: string): Promise<EmailRow | null> {
  const url = assertEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRole = assertEnv('SUPABASE_SERVICE_ROLE');

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ✅ No generic here; we cast AFTER the call
  const { data, error } = await supabase
    .from('emails')
    .select('id,to_email,from_email,subject,html_body,text_body,mailbox_id')
    .eq('id', emailId)
    .maybeSingle(); // returns null if not found, avoids 406

  if (error) throw new Error(`Supabase emails fetch failed: ${error.message}`);

  return (data as unknown as EmailRow) ?? null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      email_id: url.searchParams.get('email_id'),
      dryrun: url.searchParams.get('dryrun'),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid query params', issues: parsed.error.format() },
        { status: 400 },
      );
    }
    const { email_id, dryrun } = parsed.data;

    // 1) Load the email we’re previewing
    const emailRecord = await getEmailById(email_id);
    if (!emailRecord) {
      return NextResponse.json(
        { ok: false, error: `Email not found: ${email_id}` },
        { status: 404 },
      );
    }

    // 2) Build preview HTML (prefer stored html_body; otherwise safe text->html)
    const computedHtml =
      emailRecord.html_body ??
      (emailRecord.text_body
        ? `<p>${escapeHtml(emailRecord.text_body).replace(/\n/g, '<br>')}</p>`
        : '<p>(no preview html available)</p>');

    // 3) Choose best recipient for footer link personalization
    const toEmail =
      emailRecord.to_email ??
      emailRecord.from_email ??
      'test@example.com';

    // 4) Append visible unsubscribe footer when LIST_UNSUB_FOOTER=true
    const html = withUnsubscribeFooter(computedHtml, toEmail);

    // 5) Return in the same shape your UI expects
    return NextResponse.json({
      ok: true,
      email_id,
      dryrun: !!dryrun,
      html,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Preview error' },
      { status: 500 },
    );
  }
}
