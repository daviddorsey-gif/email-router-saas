// src/app/api/admin/test-alert/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

function getMode() {
  const mode = (process.env.SEND_MODE || "dryrun").trim().toLowerCase();
  if (mode !== "prod" && mode !== "dev" && mode !== "dryrun") return "dryrun";
  return mode as "prod" | "dev" | "dryrun";
}

function getTransport() {
  const mode = getMode();

  if (mode === "prod") {
    const host = process.env.PROD_SMTP_HOST!;
    const port = Number(process.env.PROD_SMTP_PORT ?? 587);
    const secure = String(process.env.PROD_SMTP_SECURE ?? "false") === "true";
    const user = process.env.PROD_SMTP_USER!;
    const pass = process.env.PROD_SMTP_PASS!;
    return {
      mode,
      transporter: nodemailer.createTransport({ host, port, secure, auth: { user, pass } }),
    };
  }

  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT ?? 2525);
  const secure = String(process.env.SMTP_SECURE ?? "false") === "true";
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;

  return {
    mode,
    transporter: nodemailer.createTransport({ host, port, secure, auth: { user, pass } }),
  };
}

// Quick sanity endpoint so you can open it in a browser and NOT get 404
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/admin/test-alert",
    method: "GET",
    note: "POST to this route to send a test alert",
  });
}

export async function POST() {
  try {
    const { mode, transporter } = getTransport();

    const to =
      process.env.NOTIFY_TO ||
      process.env.NOTIFY_TO_EMAIL ||
      "owner@dev.local";
    const fromEmail =
      (mode === "prod"
        ? process.env.PROD_FROM_EMAIL
        : process.env.NOTIFY_FROM_EMAIL) || "notify@dev.local";
    const fromName =
      (mode === "prod"
        ? process.env.PROD_FROM_NAME
        : process.env.NOTIFY_FROM_NAME) || "Dev Notifier";

    const subject = `[Email Router] Test admin alert (${mode})`;
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5">
        <h3>Email Router · Test Admin Alert</h3>
        <p>This is a test alert fired from the Admin Dashboard.</p>
        <ul>
          <li><b>Mode</b>: ${mode}</li>
          <li><b>App</b>: ${appUrl}</li>
        </ul>
        <p>If you're reading this, SMTP is configured and reachable.</p>
      </div>
    `;
    const text = `Email Router · Test Admin Alert
Mode: ${mode}
App: ${appUrl}
(If you're reading this, SMTP is configured and reachable.)`;

    if (mode === "dryrun") {
      return NextResponse.json({
        ok: true,
        mode,
        dryrun: true,
        meta: { to, from: `${fromName} <${fromEmail}>`, subject },
      });
    }

    const info = await transporter.sendMail({
      to,
      from: `${fromName} <${fromEmail}>`,
      subject,
      text,
      html,
      headers: { "X-Email-Router": "test-alert" },
    });

    return NextResponse.json({
      ok: true,
      mode,
      dryrun: false,
      meta: {
        to,
        messageId: info.messageId,
        accepted: info.accepted || [],
        rejected: info.rejected || [],
        response: info.response || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "send failed" },
      { status: 500 }
    );
  }
}
