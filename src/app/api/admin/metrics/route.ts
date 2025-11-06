// src/app/api/admin/metrics/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

export async function GET() {
  const sb = supabaseServer();
  const debug: Record<string, any> = {};

  // Optional window for logs; not applied to errors below by default
  const dt24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Emails: all
  const allQ = await sb.from("emails").select("id", { count: "exact", head: true });
  if (allQ.error) debug.all = allQ.error.message;

  // Emails: unmatched (your schema uses status='unmatched')
  const unmatchedQ = await sb
    .from("emails")
    .select("id", { count: "exact", head: true })
    .eq("status", "unmatched");
  if (unmatchedQ.error) debug.unmatched = unmatchedQ.error.message;

  // Emails: matched (either matched_rule_id set OR status='completed')
  const matchedQ = await sb
    .from("emails")
    .select("id", { count: "exact", head: true })
    .or("matched_rule_id.not.is.null,status.eq.completed");
  if (matchedQ.error) debug.matched = matchedQ.error.message;

  // Rules: active
  const rulesQ = await sb
    .from("faq_rules")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (rulesQ.error) debug.rules = rulesQ.error.message;

  // Logs: last 24h (for the “Processing logs (24h)” card)
  const logs24Q = await sb
    .from("processing_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", dt24h);
  if (logs24Q.error) debug.logs24 = logs24Q.error.message;

  // Errors: processing_log where result IN ('error','fail') OR action='error'
  // (No 'level' column in your table, so we don’t filter on it.)
  const errorsQ = await sb
    .from("processing_log")
    .select("id", { count: "exact", head: true })
    .in("result", ["error", "fail"]);
  // If you want 24h window instead, add: .gte("created_at", dt24h)
  if (errorsQ.error) debug.errors = errorsQ.error.message;

  return NextResponse.json(
    {
      ok: Object.keys(debug).length === 0,
      emails: {
        all: allQ.count ?? 0,
        unmatched: unmatchedQ.count ?? 0,
        matched: matchedQ.count ?? 0,
        errors: errorsQ.count ?? 0,
        today_auto: 0, // leave 0 unless you wire a “auto matched today” query
      },
      rules: rulesQ.count ?? 0,
      logs: { last24h: logs24Q.count ?? 0 },
      ts: new Date().toISOString(),
      ...(Object.keys(debug).length ? { debug } : {}),
    },
    { status: 200 }
  );
}
