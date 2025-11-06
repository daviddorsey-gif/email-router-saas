// src/lib/mailer.ts
import * as nodemailer from 'nodemailer';

type SendArgs = {
  to: string;
  from: { name: string; address: string };
  subject: string;
  html: string;
};

function buildTransport() {
  if (process.env.SMTP_URL) {
    return nodemailer.createTransport(process.env.SMTP_URL as any);
  }
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER || process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    } as any);
  }
  // Dev fallback: logs JSON to server console; doesn't actually send
  return nodemailer.createTransport({ jsonTransport: true } as any);
}

const transporter = buildTransport();

export async function sendMail({ to, from, subject, html }: SendArgs) {
  const info = await transporter.sendMail({
    to,
    from: `"${from.name}" <${from.address}>`,
    subject,
    html,
  });

  return {
    provider: 'nodemailer',
    messageId:
      (info as any).messageId ||
      (info as any).envelope?.messageId ||
      'dev-message',
    accepted: (info as any).accepted || [],
    rejected: (info as any).rejected || [],
    raw: info,
  };
}

