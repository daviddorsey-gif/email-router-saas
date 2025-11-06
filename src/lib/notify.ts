// src/lib/notify.ts
import { ENV } from '@/lib/env';
import { logUniqueAiTagged } from '@/lib/log';
import { createClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/mailer';

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

async function getEmailById(emailId: string) {
  const db = supa();
  const { data, error } = await db.from('emails').select('*').eq('id', emailId).single();
  if (error) throw error;
  return data;
}

async function getMailboxById(mailboxId: string) {
  const db = supa();
  const { data, error } = await db
    .from('mailboxes')
    .select('id, label, address')
    .eq('id', mailboxId)
    .single();
  if (error) return null;
  return data as { id: string; label?: string | null; address?: string | null };
}

function buildHtml(opts: {
  mailboxLabel?: string | null;
  fromName?: string | null;
  fromEmail?: string | null;
  subject?: string | null;
  snippet?: string | null;
  viewUrl: string;
}) {
  const { mailboxLabel, fromName, fromEmail, subject, snippet, viewUrl } = opts;
  return `
    <p><strong>Unmatched email detected.</strong></p>
    <p><b>Mailbox:</b> ${mailboxLabel ?? 'Unknown'}</p>
    <p><b>From:</b> ${fromName ?? ''} &lt;${fromEmail ?? ''}&gt;</p>
    <p><b>Subject:</b> ${subject ?? '(no subject)'}</p>
    <p><b>Preview:</b> ${snippet ?? ''}</p>
    <p><a href="${viewUrl}">Open in Admin</a></p>
  `.trim();
}

export async function notifyUnmatchedEmail(emailId: string, opts: { force?: boolean } = {}) {
  if (!ENV.NOTIFY_UNMATCHED_ENABLED) return { ok: true, skipped: 'disabled' as const };

  const db = supa();

  // Soft pre-check via (email_id, action='ai', message='unmatched_alert_sent')
  if (!opts.force) {
    const { count, error } = await db
      .from('processing_log')
      .select('id', { count: 'exact', head: true })
      .eq('email_id', emailId)
      .eq('action', 'ai')
      .eq('message', 'unmatched_alert_sent');
    if (error) throw error;
    if ((count ?? 0) > 0) return { ok: true, skipped: 'already_sent' as const };
  }

  const email = await getEmailById(emailId);
  if (!email) return { ok: false, error: 'email_not_found' as const };

  const mailbox =
    (email as any).mailbox_id ? await getMailboxById((email as any).mailbox_id) : null;

  const mailboxLabel =
    (mailbox as any)?.label ??
    mailbox?.address ??
    mailbox?.id ??
    null;

  const to = ENV.NOTIFY_UNMATCHED_TO;
  const fromName = ENV.NOTIFY_FROM_NAME;
  const fromEmail = ENV.NOTIFY_FROM_EMAIL;
  const subject = `Unmatched: ${email.subject ?? '(no subject)'}`;
  const viewUrl = `${ENV.APP_BASE_URL}/admin/emails/${emailId}`;

  const html = buildHtml({
    mailboxLabel,
    fromName: (email as any).from_name ?? null,
    fromEmail: (email as any).from_email ?? null,
    subject: (email as any).subject ?? null,
    snippet: (email as any).snippet ?? (email as any).text_preview ?? null,
    viewUrl,
  });

  const sendRes = await sendMail({
    to,
    from: { name: fromName, address: fromEmail },
    subject,
    html,
  });

  // Idempotent AI-tagged log entry (action='ai', message='unmatched_alert_sent')
  await logUniqueAiTagged(emailId, 'unmatched_alert_sent', {
    to,
    provider: sendRes?.provider ?? 'mailer',
    meta: sendRes,
  });

  return { ok: true, notified: true as const, meta: sendRes };
}
