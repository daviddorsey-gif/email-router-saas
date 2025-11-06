// src/utils/emails/unmatched.ts
import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function getEmailsWithUnmatchedStatus(limit = 100) {
  const supabase = createServerSupabaseClient();

  // 1) get latest emails
  const { data: emails, error } = await supabase
    .from("emails")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[admin] failed to load emails:", error);
    return [];
  }

  if (!emails || emails.length === 0) return [];

  // 2) get processing_log for these email ids
  const ids = emails.map((e: any) => e.id);

  const { data: logs, error: logsErr } = await supabase
    .from("processing_log")
    .select("email_id, action, result, created_at")
    .in("email_id", ids);

  const byEmail: Record<string, { unmatchedAlert: boolean }> = {};

  if (!logsErr && logs) {
    for (const log of logs) {
      if (log.action === "unmatched_alert_sent") {
        byEmail[log.email_id] = { unmatchedAlert: true };
      }
    }
  }

  // 3) merge
  return emails.map((e: any) => {
    const fromLog = byEmail[e.id];
    return {
      ...e,
      unmatched_alert_sent: fromLog ? fromLog.unmatchedAlert : false,
    };
  });
}
