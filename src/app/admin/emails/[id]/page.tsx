// src/app/admin/emails/[id]/page.tsx
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import ReplyForm from "./ReplyForm"; // ← make sure this file exists in the same folder

type UUID = string;

type Log = {
  id: UUID;
  email_id: UUID;
  created_at?: string | null;
  level?: string | null;
  event?: string | null;
  category?: string | null;
  message?: string | null;
  [key: string]: any;
};

function hasStr(v?: string | null, sub?: string) {
  return (v ?? "").toLowerCase().includes((sub ?? "").toLowerCase());
}

// SAME STATUS MODEL AS LIST/DASHBOARD: error > matched > unmatched
function deriveStatus(logs: Log[]): "matched" | "unmatched" | "error" {
  const anyError = logs.some(
    (l) => hasStr(l.level, "error") || hasStr(l["event"], "error") || hasStr(l["category"], "error")
  );
  if (anyError) return "error";

  const matched = logs.some(
    (l) => hasStr(l["event"], "matched") || hasStr(l["category"], "matched")
  );
  if (matched) return "matched";

  return "unmatched";
}

export default async function EmailDetailPage({
  params,
}: {
  params: { id: UUID };
}) {
  const sb = await createServerSupabaseClient();

  const { data: email, error: e1 } = await sb
    .from("emails")
    .select("*")
    .eq("id", params.id)
    .single();

  const { data: logs } = await sb
    .from("processing_log")
    .select("*")
    .eq("email_id", params.id)
    .order("created_at", { ascending: false });

  if (e1 || !email) {
    return (
      <main className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Email detail</h1>
          <div className="flex gap-2">
            <Link
              href="/admin/emails"
              className="inline-flex items-center rounded-xl border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Back to list
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Dashboard
            </Link>
          </div>
        </div>
        <p className="text-red-400">Failed to load email.</p>
      </main>
    );
  }

  const status = deriveStatus((logs ?? []) as Log[]);
  const fromAddr = (email.from_email ?? "").trim();
  const subjectDefault = email.subject ? `Re: ${email.subject}` : "Re: Your inquiry";
  const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET;

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Email detail</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/emails"
            className="inline-flex items-center rounded-xl border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Back to list
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-xl border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Meta */}
      <div className="rounded-2xl border border-zinc-800 p-4 mb-6">
        <div className="text-sm text-zinc-400 mb-2">Meta</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div><span className="text-zinc-400">ID:</span> {email.id}</div>
          <div><span className="text-zinc-400">Received:</span> {email.received_at ?? email.created_at ?? "—"}</div>
          <div><span className="text-zinc-400">From:</span> {(email.from_name ? `${email.from_name} ` : "") + (email.from_email ?? "")}</div>
          <div><span className="text-zinc-400">Mailbox:</span> {email.mailbox_id ?? "—"}</div>
          <div><span className="text-zinc-400">Subject:</span> {email.subject ?? "(no subject)"}</div>
          <div><span className="text-zinc-400">Category:</span> {email.category ?? "inbound"}</div>
          <div><span className="text-zinc-400">Status (derived):</span> {status}</div>
        </div>
      </div>

      {/* Bodies */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 p-4">
          <div className="text-sm text-zinc-400 mb-2">Text</div>
          <pre className="whitespace-pre-wrap text-sm text-zinc-200">
            {email.text ?? "(no text body)"}
          </pre>
        </div>
        <div className="rounded-2xl border border-zinc-800 p-4">
          <div className="text-sm text-zinc-400 mb-2">HTML</div>
          <div className="prose prose-invert max-w-none text-sm">
            <div dangerouslySetInnerHTML={{ __html: email.html ?? "" }} />
            {!email.html && <div className="text-zinc-500">(no html body)</div>}
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="rounded-2xl border border-zinc-800 p-4 mt-6">
        <div className="text-sm text-zinc-400 mb-2">Processing Log</div>
        {!logs || logs.length === 0 ? (
          <div className="text-zinc-500 text-sm">No logs for this email.</div>
        ) : (
          <div className="space-y-2">
            {logs.map((l: any) => (
              <div key={l.id} className="rounded-lg border border-zinc-800 p-2 text-sm">
                <div className="text-zinc-400">
                  {new Date(l.created_at).toLocaleString()}
                </div>
                {l.event && <div>event: {l.event}</div>}
                {l.category && <div>category: {l.category}</div>}
                {l.level && <div>level: {l.level}</div>}
                {l.message && (
                  <pre className="mt-1 whitespace-pre-wrap text-zinc-200">
                    {l.message}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply box only for unmatched */}
      {status === "unmatched" && (
        <div className="mt-6">
          <ReplyForm
            emailId={email.id}
            toDefault={fromAddr}
            subjectDefault={subjectDefault}
            adminSecret={adminSecret}
          />
        </div>
      )}
    </main>
  );
}
