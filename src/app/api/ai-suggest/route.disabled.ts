// src/app/api/ai-suggest/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!; // server-only key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // 1) Load email row
    const { data: email, error: loadErr } = await supabase
      .from("emails")
      .select("id, from_email, subject, snippet, suggested_answer")
      .eq("id", id)
      .single();

    if (loadErr || !email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }
    if (email.suggested_answer) {
      // Already has a suggestion — just return it
      return NextResponse.json({ suggested: email.suggested_answer }, { status: 200 });
    }

    // 2) Ask OpenAI for a short, helpful reply
    const system = `You are a helpful support agent. 
Reply in 2-5 short sentences, polite and clear. 
If you provide a link, use https://example.com style placeholders. 
Never include code fences or JSON—return plain text only.`;

    const user = `From: ${email.from_email ?? "unknown"}
Subject: ${email.subject ?? ""}
Body: ${email.snippet ?? ""}

Task: Draft a helpful reply to this message.`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 220,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const suggested =
      resp.choices?.[0]?.message?.content?.trim() ??
      "Thanks for reaching out! Could you share a few more details so I can help?";

    // 3) Save to DB (and mark category as 'faq' so it shows alongside matched ones)
    const { error: upErr } = await supabase
      .from("emails")
      .update({
        suggested_answer: suggested,
        category: "faq",
      })
      .eq("id", id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ suggested }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
