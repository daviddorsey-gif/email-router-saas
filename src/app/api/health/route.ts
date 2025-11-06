// app/api/health/route.ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();

  const checks: Record<string, any> = {};

  checks.app = {
    ok: true,
    env: process.env.NODE_ENV || "unknown",
  };

  checks.env = {
    inbound_secret: !!process.env.INBOUND_SECRET,
    admin_notify_secret: !!process.env.ADMIN_NOTIFY_SECRET,
    send_mode: process.env.SEND_MODE ?? "not-set",
  };

  let dbOk = false;
  let dbLatencyMs: number | null = null;
  let dbError: string | null = null;

  try {
    const supabase = createServerSupabaseClient();
    const dbStart = Date.now();
    const { error } = await supabase.from("emails").select("id").limit(1);
    const dbEnd = Date.now();
    dbLatencyMs = dbEnd - dbStart;
    dbOk = !error;
    if (error) dbError = error.message;
  } catch (err: any) {
    dbOk = false;
    dbError = String(err?.message ?? err);
  }

  checks.db = {
    ok: dbOk,
    latency_ms: dbLatencyMs,
    error: dbError,
  };

  const total = Date.now() - started;
  const healthy = checks.app.ok && checks.db.ok;

  return NextResponse.json(
    {
      ok: healthy,
      uptime_ms: total,
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
