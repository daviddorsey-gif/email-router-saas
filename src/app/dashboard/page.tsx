// src/app/dashboard/page.tsx
"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useState } from "react";

/* ---------------- Types ---------------- */
type Metrics = {
  ok: boolean;
  emails: { all: number; unmatched: number; matched: number; errors: number };
  rules: number;
  ts: string;
};

type DbCheck = { ok: boolean; latency_ms?: number; error?: string } | null;
type Health = {
  ok: boolean;
  uptime_ms?: number;
  checks?: { db?: DbCheck } & Record<string, any>;
};

/* -------------- UI helpers -------------- */
const cls = {
  card:
    "rounded-2xl border border-zinc-800/80 bg-[#0b111a] p-4 text-zinc-200",
  big: "text-5xl font-extrabold leading-none tracking-tight",
  btnWhite:
    "mt-4 inline-flex w-full items-center justify-center rounded-xl border border-zinc-300/40 bg-white text-zinc-900 px-4 py-2 font-medium hover:bg-zinc-100",
  tag: "inline-flex items-center rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300",
  sideItem:
    "block rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white border border-transparent hover:border-zinc-800",
};

/* ----------- Small components ----------- */
function StatusChip({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="ml-2 rounded-full bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-[11px] px-2 py-0.5">
      OK
    </span>
  ) : (
    <span className="ml-2 rounded-full bg-red-900/40 border border-red-700 text-red-200 text-[11px] px-2 py-0.5">
      Issue
    </span>
  );
}

function Sidebar() {
  return (
    <aside className="hidden lg:block w-64 pr-6">
      <div className="sticky top-4 space-y-2">
        <div className="text-xs mb-1 text-zinc-400">NAVIGATION</div>
        <Link href="/dashboard" className={cls.sideItem}>
          Dashboard
        </Link>
        <Link href="/admin/emails" className={cls.sideItem}>
          Inbound list
        </Link>
        <Link href="/admin/emails?filter=unmatched" className={cls.sideItem}>
          Unmatched queue
        </Link>
        <Link href="/admin/emails?filter=rules" className={cls.sideItem}>
          Matched rules
        </Link>
        <Link href="/admin/logs" className={cls.sideItem}>
          Processing logs
        </Link>

        <div className="text-xs mt-4 mb-1 text-zinc-400">SETTINGS</div>
        <Link href="/settings/rules" className={cls.sideItem}>
          Rules
        </Link>
        <Link href="/settings/mailboxes" className={cls.sideItem}>
          Mailboxes
        </Link>
        <Link href="/api/health" className={cls.sideItem}>
          API health (JSON)
        </Link>
      </div>
    </aside>
  );
}

/* ----------------- Page ----------------- */
export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [fetchErr, setFetchErr] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/metrics", { cache: "no-store" });
        if (!r.ok) throw new Error(`metrics HTTP ${r.status}`);
        const m = (await r.json()) as Metrics;

        const hr = await fetch("/api/health", { cache: "no-store" });
        const h = (await hr.json()) as Health;

        if (alive) {
          setMetrics(m);
          setHealth(h);
        }
      } catch (e: any) {
        if (alive) setFetchErr(String(e?.message || e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Defensive extraction so we never render non-strings/objects directly
  const db: DbCheck =
    (health && health.checks && (health.checks as any).db
      ? (health.checks as any).db
      : null) ?? null;

  const dbOk = !!(db && db.ok);
  const dbLatency =
    db && typeof db.latency_ms === "number" ? `${db.latency_ms}ms` : "—";
  const dbStatusText = db ? (db.ok ? "Connected" : "Issue") : "—";

  return (
    <main className="p-6 max-w-7xl mx-auto flex">
      <Sidebar />

      <section className="flex-1">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Email Router · Control Panel</h1>
          <div className="text-xs text-zinc-400">
            One-stop view: inbound, unmatched, alerts, system health.
          </div>
        </div>

        {/* HYDRATION-SAFE badges row */}
        <div className="flex gap-2 mb-4" suppressHydrationWarning>
          <span className={cls.tag}>Auto (today)</span>

          <span className={cls.tag}>
            Unmatched{" "}
            <span className="ml-1 text-amber-300">
              {metrics?.emails.unmatched ?? "—"}
            </span>
          </span>

          <span className={cls.tag}>
            Errors{" "}
            <span className="ml-1 text-red-300">
              {metrics?.emails.errors ?? "—"}
            </span>
          </span>
        </div>

        {fetchErr && (
          <div className="text-sm text-amber-300 mb-4">
            Fetch issue: {fetchErr}
          </div>
        )}

        {/* SYSTEM STATUS */}
        <div className="text-sm text-zinc-400 mb-2">SYSTEM STATUS</div>
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div className={cls.card}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                API HEALTH
                <StatusChip ok={!!health?.ok} />
              </div>
              <Link
                href="/api/health"
                className="rounded-xl border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                View
              </Link>
            </div>
            <div className="text-xs mt-2 text-zinc-400">
              GET <span className="text-zinc-300">/api/health</span> • last check: just
              now
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              Uptime:{" "}
              <span className="text-zinc-200">
                {health?.uptime_ms ? `${Math.round(health.uptime_ms / 1000)}s` : "—"}
              </span>
            </div>
          </div>

          <div className={cls.card}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                DB CONNECTIVITY
                <StatusChip ok={dbOk} />
              </div>
              <Link
                href="/admin/logs"
                className="rounded-xl border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                Open
              </Link>
            </div>
            <div className="text-xs mt-2 text-zinc-400">
              Supabase • public • status:{" "}
              <span className="text-zinc-200">{dbStatusText}</span>
            </div>
            <div className="text-xs mt-1 text-zinc-400">
              Latency: <span className="text-zinc-200">{dbLatency}</span>
            </div>
            {db && (db as any).error && (
              <div className="text-xs mt-1 text-red-300">
                Error: {(db as any).error}
              </div>
            )}
          </div>
        </div>

        {/* OPERATIONS & COMMUNICATIONS */}
        <div className="text-sm text-zinc-400 mb-2">OPERATIONS & COMMUNICATIONS</div>
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <div className={cls.card}>
            <div className="text-xs opacity-70 mb-2">INBOUND EMAILS</div>
            <div className={cls.big}>{metrics?.emails.all ?? "—"}</div>
            <div className="text-sm opacity-70 mt-1">
              From <span className="text-zinc-300">/api/inbound/postmark</span>
            </div>
            <Link href="/admin/emails" className={cls.btnWhite}>
              View inbound
            </Link>
          </div>

          <div className={cls.card}>
            <div className="text-xs opacity-70 mb-2">UNMATCHED QUEUE</div>
            <div className={cls.big}>{metrics?.emails.unmatched ?? "—"}</div>
            <div className="text-sm opacity-70 mt-1">
              Items that did not match FAQ rules.
            </div>
            <Link href="/admin/emails?filter=unmatched" className={cls.btnWhite}>
              Open unmatched
            </Link>
          </div>

          <div className={cls.card}>
            <div className="text-xs opacity-70 mb-2">MATCHED RULES</div>
            <div className={cls.big}>{metrics?.emails.matched ?? "—"}</div>
            <div className="text-sm opacity-70 mt-1">
              Messages matched by active rules.
            </div>
            <Link href="/admin/emails?filter=rules" className={cls.btnWhite}>
              View matched
            </Link>
          </div>

          <div className={cls.card}>
            <div className="text-xs opacity-70 mb-2">ERRORS</div>
            <div className={cls.big}>{metrics?.emails.errors ?? "—"}</div>
            <div className="text-sm opacity-70 mt-1">Processing failures.</div>
            <Link href="/admin/logs" className={cls.btnWhite}>
              Review errors
            </Link>
          </div>
        </div>

        {/* RULES & SETTINGS */}
        <div className="text-sm text-zinc-400 mb-2">RULES & SETTINGS</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className={cls.card}>
            <div className="text-xs opacity-70 mb-2">RULES</div>
            <div className={cls.big}>{metrics?.rules ?? "—"}</div>
            <div className="text-sm opacity-70 mt-1">Active matching rules.</div>
            <Link href="/settings/rules" className={cls.btnWhite}>
              Manage rules
            </Link>
          </div>

          <div className={cls.card}>
            <div className="text-xs opacity-70 mb-2">MAILBOXES</div>
            <div className="text-lg font-semibold">Manage Mailboxes</div>
            <div className="text-sm opacity-70 mt-1">
              Add or disable business mailboxes used for routing.
            </div>
            <Link href="/settings/mailboxes" className={cls.btnWhite}>
              Open settings
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
