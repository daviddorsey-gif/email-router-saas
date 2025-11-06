// app/api/admin/emails/[id]/resend/route.ts
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const emailId = params.id;
  const secret = process.env.ADMIN_NOTIFY_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_NOTIFY_SECRET not set" },
      { status: 500 }
    );
  }

  const url = `${baseUrl}/api/admin/notify-on-unmatched?secret=${encodeURIComponent(
    secret
  )}&email_id=${encodeURIComponent(emailId)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
    });

    const json = await res.json();

    return NextResponse.json(json, { status: res.status });
  } catch (err: any) {
    console.error("[admin resend] error:", err);
    return NextResponse.json(
      { ok: false, error: "resend failed" },
      { status: 500 }
    );
  }
}
