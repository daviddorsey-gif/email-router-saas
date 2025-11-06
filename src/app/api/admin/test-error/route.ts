// src/app/api/admin/test-error/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const admin = req.headers.get("x-admin-secret") || "";
    if (!admin || admin !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const sb = supabaseServer();

    // 1) Create a synthetic "error" email row (status = 'error')
    const { data: emailRow, error: insErr } = await sb
      .from("emails")
      .insert({
        received_at: new Date().toISOString(),
        subject: "TEST ERROR",
        text_body: "Synthetic error for dashboard test",
        html_body: "<p>Synthetic error for dashboard test</p>",
        status: "error",              // <- allowed by emails_status_check
        category: "faq",              // <- allowed by emails_category_check (faq/action/review)
        from_email: "bot@test.local",
        from_name: "Error Bot",
        message_id: crypto.randomUUID(),
      })
      .select("*")
      .single();

    if (insErr || !emailRow) {
      return NextResponse.json(
        { ok: false, error: "insert_failed", debug: insErr?.message },
        { status: 400 }
      );
    }

    // 2) Log it with an ALLOWED action
    const { error: logErr } = await sb.from("processing_log").insert({
      email_id: emailRow.id,
      action: "inbound_insert_error",     // <- allowed; do NOT use 'error'
      result: "error",                    // <- this is what your metrics count
      message: "Synthetic test error inserted via /api/admin/test-error",
      details: "dashboard_test",
      email_message_id: emailRow.message_id,
    });

    if (logErr) {
      return NextResponse.json(
        { ok: false, error: "log_insert_failed", debug: logErr.message, email_id: emailRow.id, messageId: emailRow.message_id },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      email_id: emailRow.id,
      messageId: emailRow.message_id,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unexpected" }, { status: 500 });
  }
}
