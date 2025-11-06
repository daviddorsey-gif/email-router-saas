// src/app/api/alerts/unmatched-digest/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import nodemailer from '../../../../../lib/nodemailer-shim';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ok(body: any, init = 200) {
  return NextResponse.json(body, { status: init });
}
function err(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

// Normalize secrets: trim, and strip surrounding single/double quotes if present
function normalizeSecret(s: string | null | undefined) {
  if (!s) return '';
  let out = s.trim();
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1);
  }
  return out;
}

function checkSecret(req: Request) {
  const url = new URL(req.url);
  const fromQueryRaw = url.searchParams.get('secret');
  const fromHeaderRaw = req.headers.get('x-cron-secret');
  const envRaw = process.env.CRON_SECRET;

  const fromQuery = normalizeSecret(fromQueryRaw);
  const fromHeader = normalizeSecret(fromHeaderRaw);
  const env = normalizeSecret(envRaw);

  return !!env && (fromQuery === env || fromHeader === env);
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

function fmt(ts: string | null) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

export async function GET(req: Request) {
  if (!checkSecret(req)) return err('Unauthorized', 401);

  const url = new URL(req.url);
  const sinceHours = Number(url.searchParams.get('sinceHours') || '0');

  const notifyTo = (process.env.NOTIFY_TO || '').trim();
  const fromEmail =
    process.env.NOTIFY_FROM_EMAIL ||
    process.env.REPLY_FROM_EMAIL ||
    process.env.SMTP_USER ||
    'no-reply@localhost';
  const fromName = process.env.NOTIFY_FROM_NAME || 'Router Alerts';

  // Optional time filter
  let createdGteIso: string | null = null;
  if (sinceHours > 0) {
    const d = new Date();
    d.setHours(d.getHours() - sinceHours);
    createdGteIso = d.toISOString();
  }

  // Fetch unmatched open emails
  let q = supabaseAdmin
    .from('emails')
    .select('id, subject, snippet, from_email, created_at')
    .eq('status', 'open')
    .is('matched_rule_id', null)
    .order('created_at', { ascending: false });

  if (createdGteIso) q = q.gte('created_at', createdGteIso);

  const { data, error } = await q;
  if (error) return err(error.message, 500);

  const rows = data ?? [];
  const count = rows.length;

  // If nobody to notify or nothing to send, just log once and exit
  if (!notifyTo || count === 0) {
    await supabaseAdmin.from('processing_log').insert({
      email_id: null,
      action: 'ai',
      result: 'ok',
      message: JSON.stringify({
        type: 'unmatched_digest',
        sent: false,
        reason: !notifyTo ? 'no_notify_to' : 'empty',
        sinceHours: sinceHours || null,
        count,
      }),
    });
    return ok({ ok: true, sent: false, count });
  }

  // Email content
  const subject = `[Email Router] ${count} unmatched open ${count === 1 ? 'item' : 'items'}`;

  const text = [
    `Hello,`,
    ``,
    `There ${count === 1 ? 'is' : 'are'} ${count} unmatched open ${count === 1 ? 'email' : 'emails'} in your queue.`,
    ``,
    ...rows.map((r) =>
      `• ${fmt(r.created_at)} — ${r.from_email ?? 'unknown'} — ${r.subject ?? '(no subject)'}\n  ${(r.snippet ?? '')}\n  Reply: /dashboard/reply?emailId=${r.id}`
    ),
    ``,
    `— Email Router`,
  ].join('\n');

  const html =
    `<div><p>There ${count === 1 ? 'is' : 'are'} <strong>${count}</strong> unmatched open ${count === 1 ? 'email' : 'emails'} in your queue.</p>` +
    `<ul>` +
    rows
      .map(
        (r) =>
          `<li><strong>${fmt(r.created_at)}</strong> — ${r.from_email ?? 'unknown'} — ${r.subject ?? '(no subject)'}<br/>` +
          `<div style="white-space:pre-wrap;color:#bbb">${(r.snippet ?? '').replace(/</g, '&lt;')}</div>` +
          `<div><a href="/dashboard/reply?emailId=${r.id}">Open in Dashboard</a></div></li>`
      )
      .join('') +
    `</ul><p style="color:#999">— Email Router</p></div>`;

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: notifyTo, // comma-separated allowed
      subject,
      text,
      html,
    });

    await supabaseAdmin.from('processing_log').insert({
      email_id: null,
      action: 'ai',
      result: 'ok',
      message: JSON.stringify({
        type: 'unmatched_digest',
        sent: true,
        count,
        sinceHours: sinceHours || null,
        messageId: info.messageId,
        to: notifyTo,
      }),
    });

    return ok({ ok: true, sent: true, count, messageId: info.messageId });
  } catch (e: any) {
    await supabaseAdmin.from('processing_log').insert({
      email_id: null,
      action: 'ai',
      result: 'error',
      message: String(e?.message || e),
    });
    return err(e?.message || 'Failed to send digest', 500);
  }
}
