// src/app/api/admin/faq-rules/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClientOrError } from "../../../../../lib/supabaseService";
// If your "@/..." alias isn't configured, replace the import above with:
// import { createServiceSupabaseClientOrError } from "../../../../lib/supabaseService";

function ok(body: any, status = 200) {
  return NextResponse.json({ ok: true, ...body }, { status });
}
function fail(error: string, status = 400, debug?: any) {
  const payload: any = { ok: false, error };
  if (process.env.NODE_ENV !== "production" && debug) payload.debug = debug;
  return NextResponse.json(payload, { status });
}

function getSecret(req: NextRequest) {
  const h = req.headers.get("x-admin-secret");
  if (h && h.trim()) return h.trim();
  const q = new URL(req.url).searchParams.get("admin_secret");
  return q?.trim() ?? "";
}
function auth(req: NextRequest) {
  const provided = getSecret(req);
  const expected = process.env.ADMIN_SECRET ?? "";
  if (!expected) return { ok: false, res: fail("Server misconfig: ADMIN_SECRET missing", 500) };
  if (provided !== expected) return { ok: false, res: fail("Forbidden", 403) };
  return { ok: true };
}

/**
 * Table public.faq_rules schema you shared:
 * id uuid pk, pattern text not null, answer text not null,
 * is_active boolean not null default true, priority int not null default 100,
 * created_at timestamptz not null default now(), created_by uuid null, mailbox_id uuid null
 */
export async function GET(req: NextRequest) {
  const a = auth(req);
  if (!a.ok) return a.res;

  const svc = createServiceSupabaseClientOrError();
  if (svc.error) return fail("Service client misconfig", 500, { svcError: svc.error });
  const client = svc.client!;

  try {
    const { data, error } = await client
      .from("faq_rules")
      .select("id,pattern,answer,is_active,priority,mailbox_id,created_at")
      .order("is_active", { ascending: false })
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) return fail("Select failed", 500, { supabase: error.message });
    return ok({ rules: data ?? [] });
  } catch (e: any) {
    return fail("Unhandled GET error", 500, { message: String(e?.message || e) });
  }
}

export async function POST(req: NextRequest) {
  const a = auth(req);
  if (!a.ok) return a.res;

  const svc = createServiceSupabaseClientOrError();
  if (svc.error) return fail("Service client misconfig", 500, { svcError: svc.error });
  const client = svc.client!;

  try {
    const body = await req.json();
    const action = String(body?.action ?? "").toLowerCase();

    if (action === "upsert") {
      const payload = {
        id: body.id ?? undefined, // insert if undefined
        pattern: String(body.pattern ?? ""),
        answer: String(body.response ?? body.answer ?? ""), // UI may send "response"
        is_active:
          typeof body.is_active === "boolean"
            ? body.is_active
            : String(body.enabled ?? "true") === "true",
        priority:
          body.priority === undefined || body.priority === null
            ? 100
            : Number(body.priority),
        mailbox_id: body.mailbox_id ?? null,
      };

      if (!payload.pattern.trim()) return fail("pattern is required", 400);
      if (!payload.answer.trim()) return fail("answer is required", 400);

      const { data, error } = await client
        .from("faq_rules")
        .upsert(payload)
        .select("id")
        .single();

      if (error) return fail("Upsert failed", 500, { supabase: error.message });
      return ok({ id: data?.id });
    }

    if (action === "toggle") {
      const id = String(body?.id ?? "");
      if (!id) return fail("id is required", 400);

      const next =
        typeof body.is_active === "boolean"
          ? body.is_active
          : String(body.enabled ?? "") === "true";

      const { error } = await client
        .from("faq_rules")
        .update({ is_active: next })
        .eq("id", id);

      if (error) return fail("Toggle failed", 500, { supabase: error.message });
      return ok({ id, is_active: next });
    }

    if (action === "delete") {
      const id = String(body?.id ?? "");
      if (!id) return fail("id is required", 400);

      const { error } = await client.from("faq_rules").delete().eq("id", id);
      if (error) return fail("Delete failed", 500, { supabase: error.message });
      return ok({ id });
    }

    return fail("unsupported action", 400);
  } catch (e: any) {
    return fail("Unhandled POST error", 500, { message: String(e?.message || e) });
  }
}
