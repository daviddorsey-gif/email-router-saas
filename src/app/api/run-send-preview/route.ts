// src/app/api/run-send-preview/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/run-send-preview
 * Body: { to?: string; greetingName?: string; body?: string; originalMessageId?: string; provider?: "dev" | "prod" }
 *
 * Server-side proxy to /api/debug/send-preview?provider=...
 * Injects CRON_SECRET on the server so the browser never sees it.
 */
export async function POST(req: NextRequest) {
  try {
    const CRON_SECRET = process.env.CRON_SECRET;
    if (!CRON_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Missing CRON_SECRET env" },
        { status: 500 }
      );
    }

    const payload = (await req.json().catch(() => ({}))) as {
      to?: string;
      greetingName?: string;
      body?: string;
      originalMessageId?: string;
      provider?: string;
    };

    const provider = (payload.provider || "dev").toLowerCase();
    const xfProto = req.headers.get("x-forwarded-proto");
    const xfHost = req.headers.get("x-forwarded-host");

    const origin =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (xfProto && xfHost ? `${xfProto}://${xfHost}` : `${req.nextUrl.protocol}//${req.nextUrl.host}`);

    const url = new URL("/api/debug/send-preview", origin);
    url.searchParams.set("provider", provider);

    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": CRON_SECRET,
      },
      body: JSON.stringify({
        to: payload.to,
        greetingName: payload.greetingName,
        body: payload.body,
        originalMessageId: payload.originalMessageId,
      }),
    });

    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok) {
      return NextResponse.json(
        { ok: false, status: resp.status, data },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, provider, data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Unhandled server error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
