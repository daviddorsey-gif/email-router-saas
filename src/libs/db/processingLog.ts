// src/libs/db/processingLog.ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function supa() {
  const url = assertEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = assertEnv('SUPABASE_SERVICE_ROLE');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function hasUnmatchedAlert(emailId: string) {
  const { data, error } = await supa()
    .from('processing_log')
    .select('id')
    .eq('email_id', emailId)
    .eq('action', 'unmatched_alert_sent')
    .limit(1);

  if (error) throw new Error(`processing_log check failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function markUnmatchedAlert(emailId: string, mailboxId: string | null) {
  const { error } = await supa().from('processing_log').insert({
    email_id: emailId,
    mailbox_id: mailboxId,
    action: 'unmatched_alert_sent',
    status: 'ok',
    detail: 'Admin alert sent for unmatched email',
  } as any);
  if (error) throw new Error(`processing_log insert failed: ${error.message}`);
}
