// src/app/api/reply/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type ReplyPayload = {
  emailId: string;     // UUID from public.emails.id
  toAddress: string;   // destination email address
  body: string;        // reply body text
  accessToken: string; // Supabase user access token from the client
};

export async function POST(req: Request) {
  try {
    const { emailId, toAddress, body, accessToken } = (await req.json()) as ReplyPayload;

    if (!emailId || !toAddress || !body || !accessToken) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { ok: false, error: 'Supabase environment not configured.' },
        { status: 500 }
      );
    }

    // Create a Supabase client that uses the caller's session
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // Insert the reply record (RLS allows authenticated users per your policies)
    const { error } = await supabase.from('email_replies').insert({
      email_id: emailId,
      to_address: toAddress,
      body,
      // Optional: created_by will be populated by a stricter policy later; not required now
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: `Insert failed: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Unexpected error' },
      { status: 500 }
    );
  }
}
