// src/libs/email/mailer.ts
import 'server-only';

/* eslint-disable @typescript-eslint/no-var-requires */
declare const require: any;

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export default async function sendEmail({ to, subject, html, text }: SendArgs) {
  // CJS require avoids ESM/dynamic import issues in Node runtime
  const nodemailer = require('nodemailer');

  const host = assertEnv('SMTP_HOST');
  const port = Number(process.env.SMTP_PORT || 587);
  const user = assertEnv('SMTP_USER');
  const pass = assertEnv('SMTP_PASS');

  const fromEmail = assertEnv('REPLY_FROM_EMAIL');
  const fromName = process.env.REPLY_FROM_NAME || 'Support';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  const showFooter = process.env.LIST_UNSUB_FOOTER === 'true';
  const includeMailto = process.env.LIST_UNSUB_MAILTO === 'true';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  // Build List-Unsubscribe header(s)
  const urlPart = baseUrl ? `<${baseUrl}/unsubscribe?email=${encodeURIComponent(to)}>` : '';
  const mailtoPart = includeMailto ? `<mailto:${fromEmail}?subject=unsubscribe>` : '';
  const listUnsub = [urlPart, mailtoPart].filter(Boolean).join(', ');

  const headers =
    showFooter && listUnsub
      ? {
          // ✅ fixed: use listUnsub (not listUnsubscribe)
          'List-Unsubscribe': listUnsub,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : undefined;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    text,
    headers,
  });

  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}

export type { SendArgs };
