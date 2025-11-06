// src/lib/rules.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type RuleRow = {
  id: string;
  pattern: string;
  answer: string | null;
  is_active: boolean | null;   // your schema
  priority: number | null;
};

export type CompiledRule = {
  id: string;
  pattern: string;
  answer: string | null;
  priority: number;
  regex: RegExp;
};

export type MatchResult = {
  rule: CompiledRule;
  score: number;
};

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Heuristic: if pattern contains obvious regex metacharacters, treat it as regex.
function looksLikeRegex(s: string) {
  return /[|.*+?^${}()\\[\]]/.test(s);
}

function compilePattern(pattern: string): RegExp {
  const trimmed = (pattern ?? '').trim();

  // Case 1: explicit /pattern/flags form
  const m = trimmed.match(/^\/(.+)\/([a-z]*)$/i);
  if (m) {
    const body = m[1];
    const flags = m[2] || 'i';
    return new RegExp(body, flags.includes('i') ? flags : flags + 'i');
  }

  // Case 2: looks like regex (e.g., contains "|", ".", "(", etc.) → use raw with /i
  if (looksLikeRegex(trimmed)) {
    return new RegExp(trimmed, 'i');
  }

  // Case 3: plain term → escape and search case-insensitively
  return new RegExp(escapeRegExp(trimmed), 'i');
}

/** Load active FAQ rules (is_active=true), highest priority first. */
export async function getActiveRules(): Promise<CompiledRule[]> {
  const { data, error } = await supabaseAdmin
    .from('faq_rules')
    .select('id, pattern, answer, is_active, priority')
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .order('id', { ascending: true });

  if (error) throw new Error(`Failed to fetch rules: ${error.message}`);

  const rows = (data ?? []) as RuleRow[];
  return rows
    .filter((r) => (r.pattern ?? '').trim().length > 0)
    .map((r) => ({
      id: r.id,
      pattern: r.pattern,
      answer: r.answer ?? null,
      priority: r.priority ?? 0,
      regex: compilePattern(r.pattern),
    }));
}

/** Match subject + text against compiled rules; return best match or null. */
export function matchEmailAgainstRules(
  subject: string,
  text: string,
  rules: CompiledRule[]
): MatchResult | null {
  const haystack = `${subject ?? ''}\n${text ?? ''}`;

  let best: MatchResult | null = null;
  for (const rule of rules) {
    const m = haystack.match(rule.regex);
    if (!m) continue;
    const score = (rule.priority ?? 0) + (m[0]?.length ?? 0); // simple tie-breaker
    if (!best || score > best.score) best = { rule, score };
  }
  return best;
}
// --- add below your existing exports in src/lib/rules.ts ---

/**
 * Adapter: fetches the email, loads active rules, and returns a processor-friendly shape.
 * The processor expects: { rule: { id: string }, action?: any } | null
 */
export async function matchRules(emailId: string): Promise<null | { rule: { id: string }, action?: any }> {
  // 1) Load the email we’re matching against
  const { data: email, error: eErr } = await supabaseAdmin
    .from('emails')
    .select('id, subject, text_body, mailbox_id')
    .eq('id', emailId)
    .single();

  if (eErr || !email) return null;

  // 2) Load and compile active rules (your existing function)
  const rules = await getActiveRules();
  if (!rules.length) return null;

  // 3) Match using your existing matcher
  const match = matchEmailAgainstRules(email.subject ?? '', email.text_body ?? '', rules);
  if (!match) return null;

  // 4) Return a minimal shape the processor understands
  // If your rule has a canned "answer", surface it as an action the reply system can use
  const action = match.rule.answer
    ? { type: 'canned_reply', answer: match.rule.answer }
    : undefined;

  return {
    rule: { id: match.rule.id },
    action,
  };
}
