// src/lib/env.ts
function bool(v: string | undefined, fallback = false) {
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export const ENV = {
  // sender identity
  NOTIFY_FROM_NAME: process.env.NOTIFY_FROM_NAME || 'Email Router',
  NOTIFY_FROM_EMAIL: process.env.NOTIFY_FROM_EMAIL || 'no-reply@example.com',

  // admin recipient (support both old & new names)
  NOTIFY_UNMATCHED_TO:
    process.env.NOTIFY_UNMATCHED_TO || process.env.NOTIFY_TO_EMAIL || 'owner@dev.local',

  // feature flag (support both old & new names; default true)
  NOTIFY_UNMATCHED_ENABLED:
    bool(process.env.NOTIFY_UNMATCHED_ENABLED) || bool(process.env.NOTIFY_ON_UNMATCHED, true),

  // links in emails
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',
};
