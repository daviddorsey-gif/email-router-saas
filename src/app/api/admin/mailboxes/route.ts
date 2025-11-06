// src/app/api/admin/mailboxes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpsertBody = {
  id?: string;
  label: string;
  address: string;
  stream?: string;
  enabled?: boolean;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v || v === "") throw new Error(`Missing env: ${name}`);
  return v;
}

function adminGuard(req: NextRequest) {
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || "";
  if (!adminSecret) return null; // no guard configured
  const hdr = req.headers.get("x-admin-secret") || "";
  if (hdr !== adminSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized (admin secret mismatch)" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  try {
    const SUPABASE_URL = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE = mustEnv("SUPABASE_SERVICE_ROLE");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

    const { data, error } = await sb
      .from("mailboxes")
      .select("id,label,address,stream,enabled,created_at")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: "DB select failed", details: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mailboxes: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  try {
    const body = (await req.json().catch(() => ({}))) as UpsertBody & { action?: "toggle" | "upsert" };
    const action = (body.action || "upsert").toLowerCase();

    const SUPABASE_URL = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE = mustEnv("SUPABASE_SERVICE_ROLE");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

    if (action === "toggle") {
      if (!body.id || typeof body.enabled !== "boolean") {
        return NextResponse.json({ ok: false, error: "Missing id or enabled for toggle" }, { status: 400 });
      }
      const { data, error } = await sb
        .from("mailboxes")
        .update({ enabled: body.enabled })
        .eq("id", body.id)
        .select("id,label,address,stream,enabled,created_at")
        .maybeSingle();
      if (error) return NextResponse.json({ ok: false, error: "DB update failed", details: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, mailbox: data });
    }

    // upsert
    if (!body.label || !body.address) {
      return NextResponse.json({ ok: false, error: "Missing label or address" }, { status: 400 });
    }
    const patch = {
      label: String(body.label).trim(),
      address: String(body.address).trim().toLowerCase(),
      stream: (body.stream || "support").trim(),
      enabled: typeof body.enabled === "boolean" ? body.enabled : true,
    };

    let resp;
    if (body.id) {
      resp = await sb
        .from("mailboxes")
        .update(patch)
        .eq("id", body.id)
        .select("id,label,address,stream,enabled,created_at")
        .maybeSingle();
    } else {
      resp = await sb
        .from("mailboxes")
        .insert([patch])
        .select("id,label,address,stream,enabled,created_at")
        .maybeSingle();
    }

    const { data, error } = resp;
    if (error) return NextResponse.json({ ok: false, error: "DB upsert failed", details: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, mailbox: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
