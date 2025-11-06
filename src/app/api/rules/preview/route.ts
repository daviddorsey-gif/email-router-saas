// src/app/api/rules/preview/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { getActiveRules, matchEmailAgainstRules } from '@/lib/rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  subject: z.string().default(''),
  body: z.string().default(''),
});

// Optional auth (we allow only signed-in dashboard users)
async function requireUser(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    theAnon: {
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(url, anon);
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return null;
      return data.user;
    }
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Require a logged-in user
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { subject, body } = parsed.data;

  try {
    const rules = await getActiveRules(); // uses faq_rules.is_active
    const rulesCount = rules.length;
    const patternsSample = rules.slice(0, 5).map(r => r.pattern);

    const match = matchEmailAgainstRules(subject, body, rules);

    if (!match) {
      return NextResponse.json({
        ok: true,
        match: null,
        diagnostics: { rulesCount, patternsSample },
      });
    }

    const payload = {
      ok: true,
      match: {
        rule: {
          id: match.rule.id,
          pattern: match.rule.pattern,
          answer: match.rule.answer ?? null,
        },
        score: match.score,
      },
      diagnostics: { rulesCount, patternsSample },
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to run preview' }, { status: 500 });
  }
}
