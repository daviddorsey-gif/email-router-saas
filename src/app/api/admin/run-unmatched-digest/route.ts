// src/app/api/run-unmatched-digest/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/run-unmatched-digest
 * Body: { sinceHours?: number }
 * Server-side proxy to /api/alerts/unmatched-digest?sinceHours=...
 * - Uses GET (safer for existing GET-only digest routes)
 * - Injects CRON_SECRET header
 * - Safely wraps non-JSON responses
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

    const { sinceHours } = (await req.json().catch(() => ({}))) as {
      sinceHours?: number;
    };
    const hours = Number.isFinite(sinceHours) ? Number(sinceHours) : 24;

    // Build absolute origin
    const xfProto = req.headers.get("x-forwarded-proto");
    const xfHost = req.headers.get("x-forwarded-host");
    const origin =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (xfProto && xfHost
        ? `${xfProto}://${xfHost}`
        : `${req.nextUrl.protocol}//${req.nextUrl.host}`);

    const url = new URL("/api/alerts/unmatched-digest", origin);
    url.searchParams.set("sinceHours", String(hours));

    // Use GET to maximize compatibility with existing route
    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-cron-secret": CRON_SECRET,
      },
      // no body for GET
    });

    const text = await resp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      // Upstream returned HTML/text; wrap it so the client doesn't crash
      data = { raw: text };
    }

    if (!resp.ok) {
      return NextResponse.json(
        { ok: false, status: resp.status, data },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, sinceHours: hours, data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Unhandled server error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
