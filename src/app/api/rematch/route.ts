// src/app/api/rematch/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getActiveRules, matchEmailAgainstRules } from '@/lib/rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  emailId: z.string().optional(),
  allUnmatched: z.boolean().optional(),
});

// Verify Authorization: Bearer <token>
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

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { emailId, allUnmatched } = parsed.data;
  if (!emailId && !allUnmatched) {
    return NextResponse.json({ error: 'Provide emailId or allUnmatched: true' }, { status: 400 });
  }

  // ---- Load target emails (only columns that exist in your schema)
  type MinimalEmail = { id: string; subject: string | null; snippet: string | null };

  let emails: MinimalEmail[] = [];
  if (emailId) {
    const { data, error } = await supabaseAdmin
      .from('emails')
      .select('id, subject, snippet')
      .eq('id', emailId)
      .limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    emails = (data ?? []) as MinimalEmail[];
  } else {
    const { data, error } = await supabaseAdmin
      .from('emails')
      .select('id, subject, snippet')
      .is('matched_rule_id', null)
      .eq('status', 'open')
      .limit(2000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    emails = (data ?? []) as MinimalEmail[];
  }

  const rules = await getActiveRules();
  const results: Array<{ emailId: string; ruleId: string | null; score?: number }> = [];

  for (const e of emails) {
    const subject = e.subject ?? '';
    const text = e.snippet ?? '';
    const match = matchEmailAgainstRules(subject, text, rules);

    if (match) {
      // NEW: also persist the rule's answer as the suggested reply
      await supabaseAdmin
        .from('emails')
        .update({
          matched_rule_id: match.rule.id,
          match_score: match.score,
          match_explanation: `Matched pattern: ${match.rule.pattern}`,
          suggested_answer: match.rule.answer ?? null, // <-- new
        })
        .eq('id', e.id);

      await supabaseAdmin.from('processing_log').insert({
        email_id: e.id,
        action: 'rules',
        result: 'ok',
        message: JSON.stringify({ rule_id: match.rule.id, score: match.score }),
      });

      results.push({ emailId: e.id, ruleId: match.rule.id, score: match.score });
    } else {
      await supabaseAdmin.from('processing_log').insert({
        email_id: e.id,
        action: 'rules',
        result: 'miss',
        message: '',
      });
      results.push({ emailId: e.id, ruleId: null });
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}
