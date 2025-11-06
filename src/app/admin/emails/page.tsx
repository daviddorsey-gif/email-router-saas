import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

// shape used in this view
type Row = {
  id: string;
  received_at: string | null;
  created_at: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  status: "open" | "completed" | "error" | string | null;
  category: string | null;
  mailbox_id: string | null;
  matched_rule_id: string | null;
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString();
}

function statusBadge(r: Row) {
  // IMPORTANT: status takes precedence
  if (r.status === "completed")
    return (
      <span className="px-2 py-0.5 rounded-full text-xs border bg-emerald-900/40 text-emerald-300 border-emerald-700">
        completed
      </span>
    );
  if (r.status === "error")
    return (
      <span className="px-2 py-0.5 rounded-full text-xs border bg-red-900/40 text-red-300 border-red-700">
        error
      </span>
    );

  // then structural states
  if (r.matched_rule_id)
    return (
      <span className="px-2 py-0.5 rounded-full text-xs border bg-sky-900/40 text-sky-300 border-sky-700">
        matched
      </span>
    );

  // default unmatched (open & no rule)
  return (
    <span className="px-2 py-0.5 rounded-full text-xs border bg-amber-900/40 text-amber-300 border-amber-700">
      unmatched
    </span>
  );
}

function pill(s: string) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs border bg-zinc-800/60 text-zinc-300 border-zinc-700">
      {s}
    </span>
  );
}

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filter = (searchParams.filter as string) ?? "all";
  const sb = await createServerSupabaseClient();

  // fetch latest 50 and basic counts
  const { data: rowsRaw } = await sb
    .from("emails")
    .select(
      "id, received_at, created_at, from_email, from_name, subject, status, category, mailbox_id, matched_rule_id"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (rowsRaw ?? []) as Row[];

  // derive buckets
  const unmatched = rows.filter(
    (r) => (r.status ?? "open") === "open" && !r.matched_rule_id
  );
  const matched = rows.filter((r) => !!r.matched_rule_id);
  const errors = rows.filter((r) => r.status === "error");

  let view: Row[];
  switch (filter) {
    case "unmatched":
      view = unmatched;
      break;
    case "rules":
      view = matched;
      break;
    case "errors":
      view = errors;
      break;
    default:
      view = rows;
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inbound emails</h1>
        <Link
          href="/dashboard"
          className="rounded-xl border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Dashboard
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-4">
        <Link
          href="/admin/emails"
          className={`px-3 py-1.5 rounded-xl border ${
            filter === "all"
              ? "border-zinc-500 bg-zinc-800 text-white"
              : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          }`}
        >
          All <span className="ml-1 text-xs opacity-70">{rows.length}</span>
        </Link>
        <Link
          href="/admin/emails?filter=unmatched"
          className={`px-3 py-1.5 rounded-xl border ${
            filter === "unmatched"
              ? "border-amber-600 bg-amber-900/20 text-amber-200"
              : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          }`}
        >
          Unmatched{" "}
          <span className="ml-1 text-xs opacity-70">{unmatched.length}</span>
        </Link>
        <Link
          href="/admin/emails?filter=rules"
          className={`px-3 py-1.5 rounded-xl border ${
            filter === "rules"
              ? "border-sky-600 bg-sky-900/20 text-sky-200"
              : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          }`}
        >
          Matched rules{" "}
          <span className="ml-1 text-xs opacity-70">{matched.length}</span>
        </Link>
        <Link
          href="/admin/logs"
          className={`px-3 py-1.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-900`}
        >
          Logs <span className="ml-1 text-xs opacity-70">{errors.length}</span>
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 text-sm bg-zinc-900/60 text-zinc-400">
          <div className="col-span-3">Received</div>
          <div className="col-span-3">From</div>
          <div className="col-span-3">Subject</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {view.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">No emails.</div>
        ) : (
          view.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-12 px-4 py-3 border-t border-zinc-800 text-sm items-center"
            >
              <div className="col-span-3">{fmtDate(r.received_at ?? r.created_at)}</div>
              <div className="col-span-3">
                {(r.from_name ? r.from_name + " " : "") +
                  (r.from_email ?? "") || "—"}
              </div>
              <div className="col-span-3">
                <Link
                  href={`/admin/emails/${r.id}`}
                  className="text-blue-300 hover:underline"
                >
                  {r.subject ?? "(no subject)"}
                </Link>
              </div>
              <div className="col-span-2">{statusBadge(r)}</div>
              <div className="col-span-1 text-right">
                <Link
                  href={`/admin/emails/${r.id}`}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                >
                  View
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
