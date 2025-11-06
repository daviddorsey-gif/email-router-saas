import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const INBOUND_SECRET = (process.env.INBOUND_SECRET ?? "").trim();

function fail(error: string, status = 400, debug?: any) {
  return NextResponse.json({ ok: false, error, ...(debug ? { debug } : {}) }, { status });
}
function ok(body: any) {
  return NextResponse.json({ ok: true, ...body });
}

function parseFrom(raw: string | null) {
  if (!raw) return { name: null, email: null };
  const match = raw.match(/(.*)<(.*)>/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: null, email: raw.trim() };
}

export async function POST(req: NextRequest) {
  if (!INBOUND_SECRET)
    return fail("server_misconfigured", 500, { reason: "INBOUND_SECRET missing" });

  const headerSecret = req.headers.get("x-inbound-secret") ?? "";
  const querySecret = req.nextUrl.searchParams.get("secret") ?? "";
  if ((headerSecret || querySecret).trim() !== INBOUND_SECRET)
    return fail("unauthorized", 401);

  let data;
  try {
    data = await req.json();
  } catch {
    return fail("invalid_json");
  }

  const messageId = data?.MessageID?.trim?.();
  if (!messageId) return fail("missing MessageID");

  const { name, email } = parseFrom(data?.From);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    { auth: { persistSession: false } }
  );

  // Build aligned row
  const emailRow = {
    message_id: messageId,
    external_message_id: messageId,
    from_email: email,
    from_name: name,
    subject: data?.Subject ?? "(no subject)",
    text_body: data?.TextBody ?? null,
    html_body: data?.HtmlBody ?? null,
    status: "open",
    category: null,
    received_at: new Date().toISOString(),
    raw: data,
  };

  // Attempt insert, handle duplicate gracefully
  const { data: inserted, error: insertErr } = await supabase
    .from("emails")
    .insert(emailRow)
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.message.includes("duplicate key value violates unique constraint")) {
      const { data: existing } = await supabase
        .from("emails")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();
      return ok({ reused_existing: true, email_id: existing?.id });
    }
    return fail("insert_failed", 500, { supabase: insertErr.message });
  }

  // Log entry
  await supabase.from("processing_log").insert({
    action: "inbound_received",
    result: "ok",
    email_id: inserted.id,
    message: `Stored inbound email ${messageId}`,
  });

  return ok({ email_id: inserted.id, messageId });
}
