// src/app/api/admin/rules-for-email/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const diag: any = { ok: false, steps: [] as any[] };

  try {
    // --- Optional admin guard ---
    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || "";
    if (adminSecret) {
      const hdr = req.headers.get("x-admin-secret") || "";
      if (hdr !== adminSecret) {
        diag.steps.push({ step: "auth", status: "fail", reason: "admin secret mismatch" });
        return ok(diag);
      }
    }
    diag.steps.push({ step: "auth", status: "ok" });

    // --- Params ---
    const emailId = (params?.id || "").trim();
    if (!emailId) {
      diag.steps.push({ step: "params", status: "fail", reason: "missing email id param" });
      return ok(diag);
    }
    diag.steps.push({ step: "params", status: "ok", emailId });

    // --- Envs ---
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";
    diag.steps.push({
      step: "env",
      status: SUPABASE_URL && SUPABASE_SERVICE_ROLE ? "ok" : "warn",
      NEXT_PUBLIC_SUPABASE_URL_present: !!SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_present: !!SUPABASE_SERVICE_ROLE,
    });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      diag.reason = "Missing Supabase env(s)";
      return ok(diag);
    }

    // --- Dynamic import + client ---
    let createClient: any;
    try {
      ({ createClient } = await import("@supabase/supabase-js"));
      diag.steps.push({ step: "import_supabase", status: "ok" });
    } catch (e: any) {
      diag.steps.push({ step: "import_supabase", status: "fail", error: String(e?.message || e) });
      return ok(diag);
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
    diag.steps.push({ step: "client_init", status: "ok" });

    // --- Load email (for mailbox_id etc.) ---
    const emailSel = await sb
      .from("emails")
      .select("id, mailbox_id, subject, from_email, received_at")
      .eq("id", emailId)
      .maybeSingle();

    if (emailSel.error) {
      diag.steps.push({ step: "select_email", status: "fail", error: safeErr(emailSel.error) });
      return ok(diag);
    }
    const email = emailSel.data;
    if (!email) {
      diag.steps.push({ step: "select_email", status: "fail", error: "Email not found" });
      return ok(diag);
    }
    diag.steps.push({ step: "select_email", status: "ok", mailbox_id: email.mailbox_id || null });

    // --- Read ALL rules (no filtering that assumes columns exist) ---
    let allRules: any[] = [];
    const rulesSel = await sb.from("faq_rules").select("*");
    if (rulesSel.error) {
      diag.steps.push({ step: "select_rules", status: "warn", error: safeErr(rulesSel.error) });
    } else {
      allRules = rulesSel.data || [];
      diag.steps.push({ step: "select_rules", status: "ok", count: allRules.length });
    }

    // Detect columns by sampling row keys
    const hasEnabled = allRules.some((r) => Object.prototype.hasOwnProperty.call(r ?? {}, "enabled"));
    const hasMailbox = allRules.some((r) => Object.prototype.hasOwnProperty.call(r ?? {}, "mailbox_id"));
    const hasPriority = allRules.some((r) => Object.prototype.hasOwnProperty.call(r ?? {}, "priority"));
    diag.steps.push({ step: "detect_columns", status: "ok", hasEnabled, hasMailbox, hasPriority });

    // Optional mailbox label
    let mailboxLabel: string | null = null;
    if (email.mailbox_id) {
      const mbSel = await sb.from("mailboxes").select("label").eq("id", email.mailbox_id).maybeSingle();
      if (!mbSel.error) mailboxLabel = mbSel.data?.label ?? null;
      diag.steps.push({ step: "select_mailbox_label", status: mbSel.error ? "warn" : "ok" });
    }

    // --- Filter "active" rules if `enabled` exists; otherwise treat all as active ---
    const isTruthy = (v: any) =>
      v === true || v === 1 || v === "1" || (typeof v === "string" && v.toLowerCase() === "true");
    const activeRules = hasEnabled ? allRules.filter((r) => isTruthy(r.enabled)) : allRules;

    // --- Mailbox scoping if mailbox_id exists; else treat all as global ---
    let applicable: any[];
    if (!hasMailbox) {
      applicable = activeRules;
      diag.steps.push({ step: "filter_rules", mode: "global_only", count: applicable.length });
    } else {
      const globalRules = activeRules.filter((r) => r?.mailbox_id == null);
      const specific = email.mailbox_id ? activeRules.filter((r) => r?.mailbox_id === email.mailbox_id) : [];
      applicable = [...globalRules, ...specific];
      diag.steps.push({
        step: "filter_rules",
        mode: "global_plus_specific",
        global: globalRules.length,
        specific: specific.length,
        total: applicable.length,
      });
    }

    // --- Sort by priority if the column exists and is numeric; else leave as-is ---
    if (hasPriority) {
      applicable.sort((a: any, b: any) => {
        const pa = typeof a?.priority === "number" ? a.priority : 999999;
        const pb = typeof b?.priority === "number" ? b.priority : 999999;
        return pa - pb;
      });
    }

    return ok({
      ok: true,
      email: {
        id: email.id ?? null,
        mailbox_id: email.mailbox_id ?? null,
        mailbox_label: mailboxLabel,
        subject: email.subject ?? null,
        from_email: email.from_email ?? null,
        received_at: email.received_at ?? null,
      },
      rules: applicable,
      diagnostics: diag.steps,
      schema: {
        faq_rules_table_readable: true,
        faq_rules_has_enabled: hasEnabled,
        faq_rules_has_mailbox_id: hasMailbox,
        faq_rules_has_priority: hasPriority,
      },
      note: [
        hasMailbox
          ? "Mailbox scoping active (global + specific)."
          : "No mailbox_id column detected; treating all rules as global.",
        hasEnabled
          ? "Filtered to enabled=true rules."
          : "No enabled column detected; treating all rules as active.",
      ].join(" "),
    });
  } catch (e: any) {
    return ok({ ok: false, error: "Unhandled server error (outer catch)", details: String(e?.message || e) });
  }
}

// ---- helpers ----
function ok(payload: any) {
  return NextResponse.json(payload, { status: 200 });
}
function safeErr(err: any) {
  return err?.message || err?.hint || err?.details || String(err);
}
