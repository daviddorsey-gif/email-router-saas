// src/app/api/ai-suggest/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE!; // server-only key
const openaiKey   = process.env.OPENAI_API_KEY || '';

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { emailId, subject = '', snippet = '' } = body ?? {};

    if (!emailId && !subject && !snippet) {
      return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
    }

    // 1️⃣ Try matching rule first
    const { data: rule, error: ruleErr } = await admin
      .rpc('pick_faq_rule', { _subject: subject, _snippet: snippet });

    if (ruleErr) {
      return NextResponse.json({ error: ruleErr.message }, { status: 500 });
    }

    let matched_rule_id: string | null = null;
    let suggested_answer: string | null = null;
    let category: string | null = null;

    if (rule && rule.length > 0) {
      matched_rule_id = rule[0].rule_id;
      suggested_answer = rule[0].answer;
      category = 'faq';
    }

    // 2️⃣ Optional AI fallback (only if no rule & OpenAI key is present)
    if (!suggested_answer && openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey });

      const prompt = `A user wrote this email.
Subject: "${subject}"
Snippet: "${snippet}"
Provide a short, polite answer in one or two sentences.`;

      const ai = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a concise, helpful support agent.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      });

      suggested_answer = ai.choices[0]?.message?.content?.trim() || null;
      category = suggested_answer ? 'ai' : category;
    }

    // 3️⃣ Persist result if emailId provided
    if (emailId) {
      const { error: upErr } = await admin
        .from('emails')
        .update({
          matched_rule_id,
          suggested_answer,
          category,
          auto_tag: category,
          auto_processed_at: new Date().toISOString(),
        })
        .eq('id', emailId);

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      matched_rule_id,
      suggested_answer,
      category,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
