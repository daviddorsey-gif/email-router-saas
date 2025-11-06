// src/app/api/reply/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/mailer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

function ok(body: any, status = 200) {
  return NextResponse.json({ ok: true, ...body }, { status });
}
function fail(error: string, status = 400, debug?: any) {
  const payload: any = { ok: false, error };
  if (process.env.NODE_ENV !== "production" && debug) payload.debug = debug;
  return NextResponse.json(payload, { status });
}

function getAdminSecret(req: Request) {
  const hdr = (req.headers as any).get?.("x-admin-secret") as string | null;
  if (hdr && hdr.trim()) return hdr.trim();
  const q = new URL(req.url).searchParams.get("admin_secret");
  return q?.trim() ?? "";
}

export async function POST(req: Request) {
  try {
    // Optional protection with ADMIN_SECRET.
    const expected = process.env.ADMIN_SECRET;
    if (expected && getAdminSecret(req) !== expected) {
      return fail("Forbidden", 403);
    }

    const body = await req.json();

    // Accept both payload shapes
    const emailId: string =
      String(body?.email_id ?? body?.emailId ?? "").trim();
    if (!emailId) return fail("email_id (or emailId) is required", 400);

    // Load email (defaults for to/subject)
    const { data: email, error: e1 } = await admin
      .from("emails")
      .select("*")
      .eq("id", emailId)
      .single();
    if (e1 || !email) return fail("Email not found", 404, { supabase: e1?.message });

    const to: string = String(body?.to ?? email.from_email ?? "").trim();
    if (!to) return fail("Recipient address missing", 400);

    const subject: string = String(
      body?.subject ?? (email.subject ? `Re: ${email.subject}` : "Re: Your inquiry")
    ).trim();

    // Normalize body content
    const rawHtml = typeof body?.html === "string" ? body.html.trim() : "";
    const rawText = typeof body?.text === "string" ? body.text.trim() : "";
    const legacyBody = typeof body?.body === "string" ? body.body.trim() : "";

    let html = "";
    if (rawHtml) {
      html = rawHtml;
    } else if (legacyBody) {
      // Heuristic: if legacy body looks like HTML, trust it; else wrap.
      html = /<\/?[a-z][\s\S]*>/i.test(legacyBody)
        ? legacyBody
        : `<pre>${escapeHtml(legacyBody)}</pre>`;
    } else if (rawText) {
      html = `<pre>${escapeHtml(rawText)}</pre>`;
    }

    if (!html) {
      return fail("Provide 'html' or 'text' or 'body' for the reply content.", 400);
    }

    // Build From
    const from = {
      name: process.env.REPLY_FROM_NAME || "Support Team",
      address: process.env.REPLY_FROM_EMAIL || "no-reply@example.com",
    };

    // Send using existing mailer (respects your SMTP/JSON transport)
    const sent = await sendMail({ to, from, subject, html });

    // Best-effort: write to email_outbox (ignore if table missing)
    try {
      await admin.from("email_outbox").insert({
        email_id: emailId,
        to_email: to,
        subject,
        body: html,
        status: "sent",
        provider: sent?.provider ?? "nodemailer",
        message_id: (sent as any)?.messageId ?? null,
      });
    } catch { /* ignore */ }

    // Update email status to completed (ignore if column missing)
    try {
      await admin.from("emails").update({ status: "completed" }).eq("id", emailId);
    } catch { /* ignore */ }

    // Log processing (try event/level/message first, then action/result/message)
    const logMessage = `Admin reply sent to ${to}. provider=${sent?.provider ?? "nodemailer"} messageId=${(sent as any)?.messageId ?? "dev-message"}`;
    try {
      await admin.from("processing_log").insert({
        email_id: emailId,
        event: "admin_reply_sent",
        category: "reply",
        level: "info",
        message: logMessage,
      });
    } catch {
      try {
        await admin.from("processing_log").insert({
          email_id: emailId,
          action: "reply",
          result: "ok",
          message: logMessage,
        });
      } catch { /* ignore */ }
    }

    return ok({
      email_id: emailId,
      to,
      subject,
      provider: sent?.provider ?? "nodemailer",
      messageId: (sent as any)?.messageId ?? "dev-message",
    });
  } catch (e: any) {
    return fail("Unhandled reply error", 500, { message: String(e?.message || e) });
  }
}

function escapeHtml(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
