// src/app/api/dev/send-test/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';

// Use RELATIVE imports to avoid alias issues
import sendEmail from '../../../../libs/email/mailer';
import { withUnsubscribeFooter } from '../../../../libs/email/render';

const BodySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).default('Email Router SaaS — Day 4 Unsubscribe Test'),
});

function has(v?: string | null) {
  return !!(v && v.trim().length > 0);
}
function listMissingEnvs(names: string[]) {
  return names.filter((n) => !has(process.env[n]));
}

// GET supports optional ?diag=1
export async function GET(req: Request) {
  const url = new URL(req.url);
  const diag = url.searchParams.get('diag') === '1';
  if (!diag) {
    return NextResponse.json({ ok: true, route: '/api/dev/send-test', method: 'GET' });
  }

  const required = [
    'LIST_UNSUB_FOOTER',
    'NEXT_PUBLIC_BASE_URL',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'REPLY_FROM_EMAIL',
  ];
  const missing = listMissingEnvs(required);

  // Can we require nodemailer?
  let nodemailerOk = true;
  let nodemailerErr = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('nodemailer');
  } catch (e: any) {
    nodemailerOk = false;
    nodemailerErr = e?.message || String(e);
  }

  return NextResponse.json({
    ok: missing.length === 0 && nodemailerOk,
    diag: {
      missing_envs: missing,
      nodemailer_ok: nodemailerOk,
      nodemailer_error: nodemailerErr || undefined,
      base_url: process.env.NEXT_PUBLIC_BASE_URL,
      list_unsub_footer: process.env.LIST_UNSUB_FOOTER,
    },
  });
}

// POST supports optional ?dry=1 to skip SMTP
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const dry = url.searchParams.get('dry') === '1';

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid body', issues: parsed.error.format() },
        { status: 400 },
      );
    }
    const { to, subject } = parsed.data;

    // Minimal HTML + footer
    const computedHtml = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;">
        <h2 style="margin:0 0 8px 0;">Unsubscribe Footer Test</h2>
        <p style="margin:0 0 12px 0;">This message is for Day 4 validation in dev.</p>
      </div>
    `;
    const html = withUnsubscribeFooter(computedHtml, to);

    if (dry) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
      const fromEmail = process.env.REPLY_FROM_EMAIL || '';
      const includeMailto = process.env.LIST_UNSUB_MAILTO === 'true';
      const urlPart = baseUrl ? `<${baseUrl}/unsubscribe?email=${encodeURIComponent(to)}>` : '';
      const mailtoPart = includeMailto ? `<mailto:${fromEmail}?subject=unsubscribe>` : '';
      const listUnsub = [urlPart, mailtoPart].filter(Boolean).join(', ');

      return NextResponse.json({
        ok: true,
        dry: true,
        preview: {
          subject,
          to,
          html_includes_unsub: html.includes('/unsubscribe'),
          list_unsubscribe_header: listUnsub || null,
        },
      });
    }

    const result = await sendEmail({ to, subject, html, text: 'Unsubscribe Footer Test (text)' });
    console.log('[send-test] sent:', result);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error('[send-test] error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Send error', stack: err?.stack },
      { status: 500 },
    );
  }
}
