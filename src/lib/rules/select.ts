// src/lib/rules/select.ts
// Mailbox-aware rule selection that adapts to your current schema.
// It detects columns at runtime and returns rules in the correct order.
// Safe to import from any server route (uses an existing Supabase client you pass in).

import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplicableRule = {
  id: string;
  pattern: string | null;
  priority?: number | null;
  // normalized fields:
  isActive?: boolean;
  responseText?: string | null;
  // original row for flexibility:
  _row: Record<string, any>;
};

type Detect = {
  hasMailbox: boolean;
  hasEnabled: boolean;
  hasPriority: boolean;
  answerKey: "answer" | "response_text" | "answer";
  enabledKey: "is_active" | "enabled" | "";
};

/**
 * Fetch rules that apply to a given mailbox:
 *  - If faq_rules.mailbox_id exists: return GLOBAL (NULL) + SPECIFIC (= mailboxId)
 *  - If not: return ALL rules (treated as global)
 *  - If enabled/is_active exists: filter to truthy
 *  - Sort by priority ASC when present
 *
 * You must pass an initialized Supabase service client (no env reads here).
 */
export async function getApplicableRules(
  sb: SupabaseClient,
  mailboxId: string | null
): Promise<{ rules: ApplicableRule[]; detect: Detect }> {
  // Pull all rules (schema tolerant)
  const res = await sb.from("faq_rules").select("*");
  if (res.error) {
    // If faq_rules unreadable, return empty set with defaults
    return {
      rules: [],
      detect: {
        hasMailbox: false,
        hasEnabled: false,
        hasPriority: false,
        answerKey: "answer",
        enabledKey: "",
      },
    };
  }

  const rows: Record<string, any>[] = res.data ?? [];

  const hasMailbox = hasAnyKey(rows, "mailbox_id");
  const hasEnabled = hasAnyKey(rows, "enabled") || hasAnyKey(rows, "is_active");
  const hasPriority = hasAnyKey(rows, "priority");

  const answerKey: Detect["answerKey"] =
    hasAnyKey(rows, "answer")
      ? "answer"
      : hasAnyKey(rows, "response_text")
      ? "response_text"
      : "answer"; // default to "answer"

  const enabledKey: Detect["enabledKey"] =
    hasAnyKey(rows, "is_active")
      ? "is_active"
      : hasAnyKey(rows, "enabled")
      ? "enabled"
      : "";

  // Filter active if we have an enabled column
  const isTruthy = (v: any) =>
    v === true || v === 1 || v === "1" || (typeof v === "string" && v.toLowerCase() === "true");
  const activeRows = enabledKey ? rows.filter((r) => isTruthy(r?.[enabledKey])) : rows;

  // Scope by mailbox if column exists
  let scoped = activeRows;
  if (hasMailbox) {
    const global = activeRows.filter((r) => r?.mailbox_id == null);
    const specific = mailboxId ? activeRows.filter((r) => r?.mailbox_id === mailboxId) : [];
    scoped = [...global, ...specific];
  }

  // Sort by priority if present
  if (hasPriority) {
    scoped.sort((a, b) => {
      const pa = numOr(a.priority, 999999);
      const pb = numOr(b.priority, 999999);
      return pa - pb;
    });
  }

  // Normalize a few fields so callers don't need to care about schema differences
  const rules: ApplicableRule[] = scoped.map((r) => ({
    id: r.id,
    pattern: typeof r.pattern === "string" ? r.pattern : (r.pattern ?? null),
    priority: typeof r.priority === "number" ? r.priority : null,
    isActive: enabledKey ? isTruthy(r?.[enabledKey]) : true,
    responseText:
      typeof r[answerKey] === "string" ? (r[answerKey] as string) : (r[answerKey] ?? null),
    _row: r,
  }));

  return {
    rules,
    detect: { hasMailbox, hasEnabled, hasPriority, answerKey, enabledKey },
  };
}

// ---------------- helpers ----------------
function hasAnyKey(rows: Record<string, any>[], key: string) {
  return rows.some((r) => Object.prototype.hasOwnProperty.call(r ?? {}, key));
}
function numOr(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
