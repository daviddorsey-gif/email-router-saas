// src/app/api/rules/render/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { renderTemplate, defaultReply, chooseSalutationName } from '@/lib/personalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  emailId: z.string().min(1),
});

// Verify Authorization: Bearer <token>
async function requireUser(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return null;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, anon);

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let json: any = {};
  try { json = await req.json(); } catch {}

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const emailId = parsed.data.emailId;

  // Load the email details
  const { data: emails, error: eErr } = await supabaseAdmin
    .from('emails')
    .select('id, subject, snippet, body, from_email, matched_rule_id')
    .eq('id', emailId)
    .limit(1);

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
  const email = emails?.[0];
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });

  // Choose the best salutation name (signature > email handle > "there")
  const salutationName = chooseSalutationName({
    from_email: email.from_email,
    body: email.body ?? null,
    snippet: email.snippet ?? null,
  });

  const subjectBase = email.subject ?? '(no subject)';

  // If a rule was matched, fetch its answer template from faq_rules
  let replyTemplate: string | null = null;
  if (email.matched_rule_id) {
    const { data: rules, error: rErr } = await supabaseAdmin
      .from('faq_rules')
      .select('id, pattern, answer')
      .eq('id', email.matched_rule_id)
      .limit(1);
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
    replyTemplate = rules?.[0]?.answer ?? null;
  }

  // Variables available to templates
  const vars = {
    first_name: salutationName,
    full_name: salutationName,
    subject: subjectBase,
    today: new Date().toLocaleDateString(),
  };

  // Render body (or fallback to default)
  const bodyPlain = replyTemplate
    ? renderTemplate(replyTemplate, vars)
    : defaultReply({ salutationName }); // <-- fixed: pass { salutationName }

  // Ensure subject is prefixed with "Re:"
  const subject = subjectBase.startsWith('Re:') ? subjectBase : `Re: ${subjectBase}`;

  return NextResponse.json({
    ok: true,
    subject,
    body: bodyPlain,
  });
}
