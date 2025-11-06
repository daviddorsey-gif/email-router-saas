// src/app/api/debug/send-preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { buildReplyHeaders, renderHtml, renderText } from "@/lib/email/format";

/* eslint-disable @typescript-eslint/no-var-requires */
const nodemailer = require("nodemailer");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const fail = (status: number, msg: string, extra?: any) =>
    NextResponse.json({ ok: false, error: msg, ...extra }, { status });

  try {
    // simple auth gate for this debug route
    const CRON_SECRET = process.env.CRON_SECRET;
    if (!CRON_SECRET) return fail(500, "Missing CRON_SECRET env");
    const qsSecret = req.nextUrl.searchParams.get("secret");
    const hdrSecret = req.headers.get("x-cron-secret");
    if (qsSecret !== CRON_SECRET && hdrSecret !== CRON_SECRET) {
      return fail(401, "Unauthorized (bad secret)");
    }

    // requested provider (ui hint only)
    const requested = (req.nextUrl.searchParams.get("provider") || "dev").toLowerCase() as
      | "dev"
      | "prod";

    // SERVER ENFORCEMENT
    const SEND_MODE = (process.env.SEND_MODE || "dev").toLowerCase() as "dev" | "prod" | "dryrun";
    const effective: "dev" | "prod" | "dryrun" =
      SEND_MODE === "dev" ? "dev" : SEND_MODE === "prod" ? (requested === "prod" ? "prod" : "dev") : "dryrun";

    const body = await req.json().catch(() => ({} as any));
    const subject = (body.subject as string) || `DMG Support — Formatting Preview (${effective})`;
    const greetingName = (body.greetingName as string) || "there";
    const textBody =
      (body.body as string) ||
      "Thanks for reaching out! This is our formatting preview. In production, headers, threading, and unsubscribe meta will match this shape.";

    const html = renderHtml({ subject, greetingName, body: textBody, brand: { name: "DMG Support" } });
    const text = renderText({ subject, greetingName, body: textBody, brand: { name: "DMG Support" } });

    const LIST_UNSUB_URL_BASE = process.env.LIST_UNSUB_URL_BASE || "";
    const LIST_UNSUB_MAILTO = process.env.LIST_UNSUB_MAILTO || "";

    const headers = buildReplyHeaders({
      originalMessageId: (body.originalMessageId as string) || undefined,
      listUnsubUrl: LIST_UNSUB_URL_BASE || undefined,
      listUnsubMailto: LIST_UNSUB_MAILTO || undefined,
    });

    // choose SMTP by effective mode
    const smtp = effective === "prod" ? getProdSmtp() : getDevSmtp();
    const to = (body.to as string) || smtp.user; // default target for previews
    const from = `"${smtp.fromName}" <${smtp.fromEmail}>`;

    if (effective === "dryrun") {
      return NextResponse.json({
        ok: true,
        provider: effective,
        dryrun: true,
        wouldSend: { from, to, subject, headers, textPreview: text.slice(0, 120) + "..." },
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
      subject,
      headers,
      text,
      html,
    });

    // optional shadow to Mailtrap when in PROD mode
    const shadow = process.env.SHADOW_TO_MAILTRAP?.toLowerCase() === "true";
    let shadowInfo: any = null;
    if (effective === "prod" && shadow) {
      const dev = getDevSmtp();
      const shadowTo = process.env.NOTIFY_TO || dev.user; // prefer NOTIFY_TO, else Mailtrap acct
      const devTransporter = nodemailer.createTransport({
        host: dev.host,
        port: dev.port,
        secure: dev.secure,
        auth: { user: dev.user, pass: dev.pass },
      });
      shadowInfo = await devTransporter.sendMail({
        from: `"${dev.fromName}" <${dev.fromEmail}>`,
        to: shadowTo,
        subject: `${subject} [shadow copy]`,
        headers,
        text,
        html,
      });
    }

    return NextResponse.json({
      ok: true,
      provider: effective,
      messageId: info?.messageId ?? null,
      envelope: info?.envelope ?? null,
      shadowMessageId: shadowInfo?.messageId ?? null,
      headers,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Unhandled server error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
