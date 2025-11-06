// src/lib/process-email.ts
import { logEvent } from '@/lib/log';
import { notifyUnmatchedEmail } from '@/lib/notify';
import { matchRules } from '@/lib/rules';

export async function processEmail(emailId: string) {
  const match = await matchRules(emailId);

  if (match?.rule) {
    await logEvent(emailId, 'rules', {
      rule_id: match.rule.id,
      action: match.action ?? null,
    });
    return { ok: true, path: 'matched', ruleId: match.rule.id };
  }

  const notify = await notifyUnmatchedEmail(emailId);

  await logEvent(emailId, 'ai', {
    notified: !!notify?.notified,
    subtype: 'unmatched',
  }, { message: 'unmatched' });

  return { ok: true, path: 'unmatched', notified: notify?.notified === true };
}
