// src/app/api/admin/send-reply/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderHtml, renderText, buildReplyHeaders } from "@/lib/email/format";

/* eslint-disable @typescript-eslint/no-var-requires */
const nodemailer = require("nodemailer");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// -------- types --------
type SendBody = {
  emailId: string;
  provider?: "dev" | "prod"; // UI hint; server enforces SEND_MODE
  subject?: string;
  body?: string;
  to?: string;
  originalMessageId?: string;
  greetingName?: string;
};

// -------- env helpers --------
function mustEnv(name: string) {
  const v = process.env[name];
  if (!v || v === "") throw new Error(`Missing env: ${name}`);
  return v;
}
function intEnv(name: string) {
  const n = parseInt(mustEnv(name), 10);
  if (Number.isNaN(n)) throw new Error(`Env ${name} must be an integer`);
  return n;
}
function boolEnv(name: string) {
  return mustEnv(name).toLowerCase() === "true";
}

// -------- smtp resolvers --------
function getDevSmtp() {
  return {
    host: mustEnv("SMTP_HOST"),
    port: intEnv("SMTP_PORT"),
    secure: boolEnv("SMTP_SECURE"),
    user: mustEnv("SMTP_USER"),
    pass: mustEnv("SMTP_PASS"),
    fromEmail: mustEnv("REPLY_FROM_EMAIL"),
    fromName: process.env.REPLY_FROM_NAME || "Support Team",
  };
}
function getProdSmtp() {
  return {
    host: mustEnv("PROD_SMTP_HOST"),
    port: intEnv("PROD_SMTP_PORT"),
    secure: boolEnv("PROD_SMTP_SECURE"),
    user: mustEnv("PROD_SMTP_USER"),
    pass: mustEnv("PROD_SMTP_PASS"),
    fromEmail: mustEnv("PROD_FROM_EMAIL"),
    fromName: process.env.PROD_FROM_NAME || "Support Team",
  };
}

export async function POST(req: NextRequest) {
  try {
    // optional admin guard
    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || "";
    if (adminSecret) {
      const hdr = req.headers.get("x-admin-secret") || "";
      if (hdr !== adminSecret) {
        return NextResponse.json({ ok: false, error: "Unauthorized (admin secret mismatch)" }, { status: 401 });
      }
    }

    const payload = (await req.json().catch(() => ({}))) as SendBody;
    const emailId = (payload.emailId || "").trim();
    if (!emailId) return NextResponse.json({ ok: false, error: "Missing required field: emailId" }, { status: 400 });

    // SERVER ENFORCEMENT
    const SEND_MODE = (process.env.SEND_MODE || "dev").toLowerCase() as "dev" | "prod" | "dryrun";
    const requested = (payload.provider || "dev").toLowerCase() as "dev" | "prod";
    const effective: "dev" | "prod" | "dryrun" =
      SEND_MODE === "dev" ? "dev" : SEND_MODE === "prod" ? (requested === "prod" ? "prod" : "dev") : "dryrun";

    const SUPABASE_URL = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE = mustEnv("SUPABASE_SERVICE_ROLE");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

    // fetch target email
    const { data: emailRow, error: selErr } = await sb
      .from("emails")
      .select("id, message_id, from_email, from_name, subject, text_body, html_body, received_at, status")
      .eq("id", emailId)
      .maybeSingle();

    if (selErr) return NextResponse.json({ ok: false, error: "DB select failed", details: selErr.message }, { status: 500 });
    if (!emailRow) return NextResponse.json({ ok: false, error: "Email not found" }, { status: 404 });

    const to = payload.to?.trim() || emailRow.from_email || "";
    if (!to && effective !== "dryrun") return NextResponse.json({ ok: false, error: "No recipient available" }, { status: 400 });

    const replySubject = payload.subject || `Re: ${emailRow.subject || "your message"}`;
    const greetingName = payload.greetingName || (emailRow.from_name || "there");
    const plain = payload.body || "Thanks for reaching out! Here’s our reply.";

    const html = renderHtml({ subject: replySubject, greetingName, body: plain, brand: { name: "DMG Support" } });
    const text = renderText({ subject: replySubject, greetingName, body: plain, brand: { name: "DMG Support" } });

    const LIST_UNSUB_URL_BASE = process.env.LIST_UNSUB_URL_BASE || "";
    const LIST_UNSUB_MAILTO = process.env.LIST_UNSUB_MAILTO || "";

    const headers = buildReplyHeaders({
      originalMessageId: payload.originalMessageId || emailRow.message_id || undefined,
      listUnsubUrl: LIST_UNSUB_URL_BASE || undefined,
      listUnsubMailto: LIST_UNSUB_MAILTO || undefined,
    });

    // choose SMTP by effective mode
    const smtp = effective === "prod" ? getProdSmtp() : getDevSmtp();
    const from = `"${smtp.fromName}" <${smtp.fromEmail}>`;

    if (effective === "dryrun") {
      // log breadcrumb, but don't send
      await sb.from("processing_log").insert([
        {
          email_message_id: emailRow.message_id || emailRow.id,
          action: "reply_dryrun",
          details: `DRYRUN would send to=${to || "(none)"} subject="${replySubject}"`,
          created_at: new Date().toISOString(),
        },
      ]);
      return NextResponse.json({
        ok: true,
        provider: effective,
        dryrun: true,
        wouldSend: { from, to, subject: replySubject, headers, textPreview: text.slice(0, 120) + "..." },
      });
    }

    // send via effective transport
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject: replySubject,
      headers,
      text,
      html,
    });

    // shadow copy to Mailtrap if enabled in prod
    const shadow = process.env.SHADOW_TO_MAILTRAP?.toLowerCase() === "true";
    let shadowInfo: any = null;
    if (effective === "prod" && shadow) {
      const dev = getDevSmtp();
      const shadowTo = process.env.NOTIFY_TO || dev.user;
      const devTransporter = nodemailer.createTransport({
        host: dev.host,
        port: dev.port,
        secure: dev.secure,
        auth: { user: dev.user, pass: dev.pass },
      });
      shadowInfo = await devTransporter.sendMail({
        from: `"${dev.fromName}" <${dev.fromEmail}>`,
        to: shadowTo,
        subject: `${replySubject} [shadow copy]`,
        headers,
        text,
        html,
      });
    }

    // logs
    await sb.from("processing_log").insert([
      {
        email_message_id: emailRow.message_id || emailRow.id,
        action: effective === "prod" ? "reply_sent_prod" : "reply_sent_dev",
        details: `SMTP ${smtp.host}:${smtp.port} secure=${smtp.secure} messageId=${info?.messageId || ""} shadow=${shadow ? "on" : "off"}`,
        created_at: new Date().toISOString(),
      },
    ]);

    // best-effort email_replies insert
    try {
      await sb.from("email_replies").insert([
        {
          email_id: emailRow.id,
          to_email: to,
          subject: replySubject,
          body_text: text,
          body_html: html,
          provider: effective === "prod" ? "prod" : "dev",
          sent_at: new Date().toISOString(),
          transport_message_id: info?.messageId || null,
        },
      ]);
    } catch {
      // ignore if table not present
    }

    // keep existing behavior
    await sb.from("emails").update({ status: "completed" }).eq("id", emailRow.id);

    return NextResponse.json({
      ok: true,
      provider: effective,
      transportMessageId: info?.messageId || null,
      shadowMessageId: shadowInfo?.messageId || null,
      envelope: info?.envelope || null,
      headers,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Unhandled server error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
