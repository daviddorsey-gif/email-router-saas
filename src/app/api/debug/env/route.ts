// src/app/api/debug/env/route.ts
import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';

export function GET() {
  return NextResponse.json({
    fromName: ENV.NOTIFY_FROM_NAME,
    fromEmail: ENV.NOTIFY_FROM_EMAIL,
    unmatchedTo: ENV.NOTIFY_UNMATCHED_TO,
    unmatchedEnabled: ENV.NOTIFY_UNMATCHED_ENABLED,
    appBaseUrl: ENV.APP_BASE_URL,
  });
}
