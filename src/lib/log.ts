// src/lib/log.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// DB permits only these action values via CHECK constraint.
const ALLOWED_ACTIONS = new Set<'rules' | 'ai'>(['rules', 'ai']);

function getAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // dev fallback only
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  return createClient(url, key);
}

function toText(details: unknown): string | null {
  if (details == null) return null;
  try { return typeof details === 'string' ? details : JSON.stringify(details); }
  catch { return String(details); }
}

/**
 * Generic logger — writes ONLY the two allowed actions ('rules' | 'ai').
 * - result: NOT NULL (defaults to 'ok')
 * - message: short subtype (e.g., 'unmatched', 'unmatched_alert_sent')
 */
export async function logEvent(
  emailId: string,
  action: 'rules' | 'ai',
  details: unknown = null,
  extra: { result?: string | null; message?: string | null; email_message_id?: string | null } = {}
) {
  if (!ALLOWED_ACTIONS.has(action)) {
    return { ok: true, skipped: 'action_not_allowed', action };
  }

  const supabase = getAdmin();
  const payload = {
    email_id: emailId,
    action,                                   // 'rules' or 'ai'
    result: extra.result ?? 'ok',             // NOT NULL in your schema
    message: extra.message ?? '',             // short subtype / label
    email_message_id: extra.email_message_id ?? null,
    details: toText(details),
  };

  const { data, error } = await supabase
    .from('processing_log')
    .insert(payload as any)
    .select()
    .single();

  if (error) throw error;
  return { ok: true, data };
}

/**
 * Idempotent helper for AI-side sub-events, keyed by (email_id, action='ai', message=<tag>).
 * Example tag: 'unmatched_alert_sent'
 */
export async function logUniqueAiTagged(
  emailId: string,
  tag: string,                  // e.g., 'unmatched_alert_sent'
  details: unknown = null
) {
  const supabase = getAdmin();

  // Soft guard first (DB partial unique index below is the hard guard)
  const { count, error: cErr } = await supabase
    .from('processing_log')
    .select('id', { count: 'exact', head: true })
    .eq('email_id', emailId)
    .eq('action', 'ai')
    .eq('message', tag);

  if (cErr) throw cErr;
  if ((count ?? 0) > 0) return { ok: true, skipped: 'already_logged' as const };

  const payload = {
    email_id: emailId,
    action: 'ai' as const,
    result: 'ok',
    message: tag,               // sub-event label
    email_message_id: null,
    details: toText(details),
  };

  const { data, error, status } = await supabase
    .from('processing_log')
    .insert(payload as any)
    .select()
    .single();

  // If you later add the DB partial unique index, this will resolve 409s cleanly
  if (status === 409 || (error && (error as any).code === '23505')) {
    return { ok: true, skipped: 'already_logged' as const };
  }
  if (error) throw error;
  return { ok: true, data };
}

