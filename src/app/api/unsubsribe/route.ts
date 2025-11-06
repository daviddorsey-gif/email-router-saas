// src/app/api/unsubscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Implements List-Unsubscribe (RFC 8058) One-Click:
 * - Providers POST with body: "List-Unsubscribe=One-Click"
 * - Some providers GET the URL instead
 *
 * We don't maintain a suppression list yet; for now we just log the request
 * to processing_log so you have an audit trail. Later we can add a
 * "email_suppressions" table or integrate Postmark suppressions.
 */
export async function GET(req: NextRequest) {
  return handleUnsub(req, "GET");
}

export async function POST(req: NextRequest) {
  return handleUnsub(req, "POST");
}

async function handleUnsub(req: NextRequest, method: "GET" | "POST") {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || ""; // optional: pass any opaque token you attach in headers
    const recipient = url.searchParams.get("recipient") || ""; // optional: if you decide to include a recipient hint

    // If POST, validate One-Click body when present (per RFC 8058)
    if (method === "POST") {
      const text = await req.text().catch(() => "");
      // Many providers send exactly: "List-Unsubscribe=One-Click"
      if (text && !/^List-Unsubscribe=One-Click$/i.test(text.trim())) {
        // Not fatal; we’ll still accept but note the mismatch
      }
    }

    // Log to processing_log for auditing
    const SUPABASE_URL = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE = mustEnv("SUPABASE_SERVICE_ROLE");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

    await sb.from("processing_log").insert([
      {
        email_message_id: token || recipient || "unsubscribe",
        action: "list_unsubscribe",
        details: `method=${method}; token=${token || "-"}; recipient=${recipient || "-"}`,
        created_at: new Date().toISOString(),
      },
    ]);

    // Minimal success response; 204 is common for one-click
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Unhandled server error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// ---- helpers
function mustEnv(name: string) {
  const v = process.env[name];
  if (!v || v === "") throw new Error(`Missing env: ${name}`);
  return v;
}
