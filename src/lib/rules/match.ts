// src/lib/rules/match.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { getApplicableRules } from './select';

type UUID = string;

export type EmailRow = {
  id: UUID;
  subject: string | null;
  text: string | null;     // plain text body, if already extracted
  html: string | null;     // raw html (fallback if text missing)
  mailbox_id: UUID | null; // nullable by schema
  norm_text?: string | null;
};

/**
 * Minimal shape expected from src/lib/rules/select.ts after normalization:
 * - responseText is mapped from faq_rules.answer
 * - rules are active; we will enforce evaluation order locally
 */
export type Rule = {
  id: UUID;
  pattern: string;
  priority: number;
  responseText: string;
  mailbox_id: UUID | null;
};

export type MatchResult =
  | {
      matched: true;
      rule: Rule;
      responseBody: string; // use rule.responseText
    }
  | {
      matched: false;
      rule: null;
      responseBody: null;
    };

/**
 * Build the candidate text to test patterns against.
 */
function buildCandidateText(email: EmailRow): string {
  if (email.norm_text && email.norm_text.trim().length > 0) {
    return email.norm_text.toLowerCase();
  }

  const subject = (email.subject ?? '').trim();
  const body =
    (email.text && email.text.trim().length > 0
      ? email.text
      : email.html ?? '') || '';

  return `${subject}\n${body}`.toLowerCase();
}

/**
 * Test a rule.pattern against the candidate text.
 * Supports:
 *  - bare substring match (case-insensitive)
 *  - simple /.../i regex style (leading & trailing slashes mean regex; flags optional)
 */
function patternMatchesText(pattern: string, candidate: string): boolean {
  const p = (pattern ?? '').trim();
  if (!p) return false;

  // Regex style: /.../ or /.../i
  if (p.startsWith('/') && p.lastIndexOf('/') > 0) {
    const lastSlash = p.lastIndexOf('/');
    const expr = p.slice(1, lastSlash);
    const flags = p.slice(lastSlash + 1); // '' or valid JS flags like i,m,u,g,y,s

    try {
      const re = new RegExp(expr, flags && /^[gimsuy]*$/.test(flags) ? flags : 'i');
      return re.test(candidate);
    } catch {
      // If invalid regex, fall back to substring behavior
      return candidate.includes(p.toLowerCase());
    }
  }

  // Default: case-insensitive substring
  return candidate.includes(p.toLowerCase());
}

/**
 * Mailbox-aware matcher:
 * - Fetch rules via getApplicableRules(sb, email.mailbox_id)
 * - Sort so mailbox-specific rules are evaluated before global, and higher priority first
 * - Return first match; use rule.responseText as the outbound body
 *
 * AI/unmatched behavior stays upstream and unchanged.
 */
export async function matchEmail(
  sb: SupabaseClient,
  email: EmailRow
): Promise<MatchResult> {
  const candidate = buildCandidateText(email);

  // Fetch mailbox-aware rules (global + mailbox-specific)
  const raw = await getApplicableRules(sb, email.mailbox_id as UUID | null);

  // Normalize to Rule[] and enforce evaluation order here:
  // 1) mailbox-specific first (non-null mailbox_id)
  // 2) higher priority first (DESC)
  const rules: Rule[] = (Array.isArray(raw) ? raw : [])
    .filter((r: any) => r && typeof r.pattern === 'string')
    .map((r: any) => ({
      id: String(r.id),
      pattern: String(r.pattern ?? ''),
      priority: Number(r.priority ?? 0),
      responseText: String(r.responseText ?? r.answer ?? ''),
      mailbox_id: (r.mailbox_id ?? null) as UUID | null,
    }))
    .sort((a, b) => {
      const aScoped = a.mailbox_id ? 0 : 1;
      const bScoped = b.mailbox_id ? 0 : 1;
      if (aScoped !== bScoped) return aScoped - bScoped; // scoped before global
      return (b.priority ?? 0) - (a.priority ?? 0); // higher priority first
    });

  for (const rule of rules) {
    if (!rule.pattern) continue;
    if (patternMatchesText(rule.pattern, candidate)) {
      const responseBody = rule.responseText ?? '';
      return {
        matched: true,
        rule,
        responseBody,
      };
    }
  }

  return {
    matched: false,
    rule: null,
    responseBody: null,
  };
}
