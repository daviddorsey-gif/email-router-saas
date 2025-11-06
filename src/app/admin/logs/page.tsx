// src/app/admin/logs/page.tsx
import Link from "next/link";
import { supabaseServer } from "../../lib/supabaseServer";

type Row = {
  id: string;
  created_at: string;
  action: string | null;
  result: string | null;
  message: string | null;
  details: string | null;
  email_id: string | null;
  email_message_id: string | null;
};

function deriveBadge(result?: string | null, action?: string | null) {
  const isErr = (result && ["error", "fail"].includes(result)) || action === "error";
  return isErr ? (
    <span className="px-2 py-0.5 rounded-full text-xs bg-red-900/40 text-red-200 border border-red-700/50">
      error
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-300 border border-zinc-700/60">
      info
    </span>
  );
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams?: { level?: string; q?: string };
}) {
  const sb = supabaseServer();

  const level = (searchParams?.level ?? "").toLowerCase(); // 'error' | 'info' | ''
  const q = (searchParams?.q ?? "").trim();

  let query = sb
    .from("processing_log")
    .select("id, created_at, action, result, message, details, email_id, email_message_id")
    .order("created_at", { ascending: false });

  // Derived "level" filter
  if (level === "error") {
    query = query.in("result", ["error", "fail"]);
  } else if (level === "info") {
    query = query.neq("action", "error").eq("result", "ok");
  }

  // Simple search across a few text columns
  if (q) {
    // Use ilike on message/details/action
    query = query.or(
      [
        `message.ilike.%${q}%`,
        `details.ilike.%${q}%`,
        `action.ilike.%${q}%`,
        `email_message_id.ilike.%${q}%`,
      ].join(",")
    );
  }

  const { data, error } = await query.limit(100);
  const rows = (data ?? []) as Row[];

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Processing logs</h1>
        <Link
          href="/dashboard"
          className="rounded-xl border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Back to dashboard
        </Link>
      </div>

      <form className="flex gap-3 mb-4" method="get">
        <select
          name="level"
          defaultValue={level || ""}
          className="w-56 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 px-3 py-2"
        >
          <option value="">(any)</option>
          <option value="error">error</option>
          <option value="info">info</option>
        </select>
        <input
          name="q"
          defaultValue={q}
          placeholder="action/result/message/details/email_message_id contains…"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 px-3 py-2"
        />
        <button className="rounded-md border border-zinc-700 px-4 py-2 hover:bg-zinc-800">
          Apply
        </button>
      </form>

      <div className="rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-12 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-400">
          <div className="col-span-3">Time</div>
          <div className="col-span-1">Level</div>
          <div className="col-span-2">Action</div>
          <div className="col-span-1">Result</div>
          <div className="col-span-2">Email</div>
          <div className="col-span-3">Message / Details</div>
        </div>

        {error ? (
          <div className="px-4 py-3 text-red-400 text-sm">
            Failed to load logs: {error.message}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-3 text-zinc-400 text-sm">No logs.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="grid grid-cols-12 px-4 py-2 border-t border-zinc-800 text-sm">
              <div className="col-span-3 text-zinc-300">
                {new Date(r.created_at).toLocaleString()}
              </div>
              <div className="col-span-1">{deriveBadge(r.result, r.action)}</div>
              <div className="col-span-2 text-zinc-200">{r.action ?? "—"}</div>
              <div className="col-span-1 text-zinc-400">{r.result ?? "—"}</div>
              <div className="col-span-2">
                {r.email_id ? (
                  <Link href={`/admin/emails/${r.email_id}`} className="text-sky-300 hover:underline">
                    {`${r.email_id.slice(0, 8)}…`}
                  </Link>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </div>
              <div className="col-span-3 text-zinc-300">
                {r.message || r.details || "—"}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

// Opt out of caching to avoid stale lists
export const dynamic = "force-dynamic";
export const revalidate = 0;
