// src/libs/notify/admin.ts
import 'server-only';
/* eslint-disable @typescript-eslint/no-var-requires */
declare const require: any;

import sendEmail from '../email/mailer';

export type UnmatchedAlert = {
  emailId: string;
  mailboxId: string | null;
  fromEmail: string | null;
  subject: string | null;
  snippet: string | null;
};

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) =>
    ch === '&' ? '&amp;'
    : ch === '<' ? '&lt;'
    : ch === '>' ? '&gt;'
    : ch === '"' ? '&quot;'
    : '&#39;',
  );
}

export async function notifyAdminUnmatched(payload: UnmatchedAlert) {
  if (process.env.NOTIFY_ON_UNMATCHED !== 'true') {
    return { skipped: true, reason: 'disabled' };
  }

  // Your existing env names
  const to = assertEnv('NOTIFY_TO_EMAIL');
  const fromEmail = assertEnv('NOTIFY_FROM_EMAIL'); // not used directly here, kept for consistency
  const fromName = process.env.NOTIFY_FROM_NAME || 'Router Notifier';

  const heading = 'Unmatched Email Alert';
  const bodyLines: string[] = [];
  bodyLines.push(`<strong>Email ID:</strong> ${payload.emailId}`);
  if (payload.mailboxId) bodyLines.push(`<strong>Mailbox ID:</strong> ${payload.mailboxId}`);
  if (payload.fromEmail) bodyLines.push(`<strong>From:</strong> ${payload.fromEmail}`);
  if (payload.subject) bodyLines.push(`<strong>Subject:</strong> ${escapeHtml(payload.subject)}`);
  if (payload.snippet) bodyLines.push(`<strong>Snippet:</strong> ${escapeHtml(payload.snippet)}`);

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;line-height:1.5">
      <h2 style="margin:0 0 10px 0;">${heading}</h2>
      <p style="margin:0 0 12px 0;">No rules matched this incoming email. Please review and reply manually or add a rule.</p>
      <div style="font-size:14px;color:#111">
        ${bodyLines.map((l) => `<p style="margin:0 0 6px 0;">${l}</p>`).join('')}
      </div>
    </div>
  `;

  const text = [
    heading,
    `Email ID: ${payload.emailId}`,
    payload.mailboxId ? `Mailbox ID: ${payload.mailboxId}` : '',
    payload.fromEmail ? `From: ${payload.fromEmail}` : '',
    payload.subject ? `Subject: ${payload.subject}` : '',
    payload.snippet ? `Snippet: ${payload.snippet}` : '',
  ].filter(Boolean).join('\n');

  const res = await sendEmail({
    to,
    subject: 'Unmatched Email Alert',
    html,
    text,
  });

  return { ok: true, result: res };
}
