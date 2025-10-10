
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// This route runs via POST /api/ai-fallback/run
export async function POST(req: Request) {
  try {
    const auth = req.headers.get('x-cron-secret');
    if (auth !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    // 1️⃣  Find emails that still need AI help
    const { data: emails, error: fetchError } = await supabase
      .from('emails')
      .select('id, subject, snippet')
      .eq('status', 'open')
      .is('matched_rule_id', null)
      .is('suggested_answer', null)
      .limit(10);

    if (fetchError) throw fetchError;
    if (!emails?.length) return NextResponse.json({ ok: true, processed: 0 });

    let processed = 0;

    for (const email of emails) {
      try {
        // 2️⃣  Ask OpenAI for a suggested answer
        const prompt = `You are an assistant for a training company. 
Generate a short, polite email reply that addresses this inquiry:
Subject: ${email.subject}
Message: ${email.snippet}`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100,
          temperature: 0.5,
        });

        const suggestion = completion.choices[0]?.message?.content?.trim() ?? '';

        if (suggestion) {
          await supabase
            .from('emails')
            .update({
              suggested_answer: suggestion,
              auto_tag: true,
              auto_processed_at: new Date().toISOString(),
            })
            .eq('id', email.id);

          await supabase.from('processing_log').insert({
            action: 'ai',
            result: 'ok',
            email_id: email.id,
            message: suggestion.slice(0, 100),
          });
          processed++;
        } else {
          await supabase.from('processing_log').insert({
            action: 'ai',
            result: 'miss',
            email_id: email.id,
            message: 'no answer from model',
          });
        }
      } catch (innerError: any) {
        await supabase.from('processing_log').insert({
          action: 'ai',
          result: 'error',
          email_id: email.id,
          message: innerError.message || 'unknown error',
        });
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch (error: any) {
    console.error('AI fallback error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
