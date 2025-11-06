// src/app/settings/rules/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Rule = {
  id: string;
  pattern: string;
  answer: string;
  is_active: boolean;
  priority: number;
  mailbox_id: string | null;
  created_at: string;
};

export default function RulesSettingsPage() {
  const [items, setItems] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // form state
  const [id, setId] = useState<string>("");
  const [pattern, setPattern] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [priority, setPriority] = useState<number | "">("");
  const [mailboxId, setMailboxId] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string>("");

  // Client-exposed secret (must match ADMIN_SECRET). This is inlined at build time.
  const adminSecret =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_ADMIN_SECRET as string | undefined)
      : undefined;

  // Build headers + query fallback
  function buildInit(method?: string, body?: any): RequestInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (adminSecret) headers["x-admin-secret"] = adminSecret;
    const init: RequestInit = { cache: "no-store", headers };
    if (method) init.method = method;
    if (body) init.body = JSON.stringify(body);
    return init;
  }
  function withSecretQS(path: string) {
    // server route accepts ?admin_secret=... as a fallback
    if (!adminSecret) return `${path}`; // no secret available; will 403 with a clear message
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}admin_secret=${encodeURIComponent(adminSecret)}`;
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(withSecretQS("/api/admin/faq-rules"), buildInit());
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setItems(data.rules || []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearForm() {
    setId("");
    setPattern("");
    setAnswer("");
    setPriority("");
    setMailboxId("");
    setIsActive(true);
    setResult("");
  }

  function edit(r: Rule) {
    setId(r.id);
    setPattern(r.pattern ?? "");
    setAnswer(r.answer ?? "");
    setPriority(typeof r.priority === "number" ? r.priority : "");
    setMailboxId((r.mailbox_id as string) ?? "");
    setIsActive(!!r.is_active);
    setResult("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setSaving(true);
    setResult("");
    try {
      const body = {
        action: "upsert",
        id: id || undefined,
        pattern,
        response: answer, // API maps response -> answer
        priority: priority === "" ? undefined : Number(priority),
        mailbox_id: mailboxId || undefined,
        is_active: isActive,
      };
      const res = await fetch(withSecretQS("/api/admin/faq-rules"), buildInit("POST", body));
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setResult("Saved.");
      await load();
      clearForm();
    } catch (e: any) {
      setResult(`Error: ${String(e?.message || e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule: Rule, next: boolean) {
    try {
      const body = { action: "toggle", id: rule.id, is_active: next };
      const res = await fetch(withSecretQS("/api/admin/faq-rules"), buildInit("POST", body));
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      await load();
    } catch {
      // ignore
    }
  }

  async function remove(rule: Rule) {
    try {
      const body = { action: "delete", id: rule.id };
      const res = await fetch(withSecretQS("/api/admin/faq-rules"), buildInit("POST", body));
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      await load();
    } catch {
      // ignore
    }
  }

  const card =
    "rounded-2xl border border-gray-200/30 dark:border-gray-800/60 p-4";
  const input =
    "mt-1 w-full rounded-md border border-gray-300/40 dark:border-gray-700/60 " +
    "bg-white dark:bg-transparent text-gray-900 dark:text-gray-100 " +
    "placeholder-gray-400 dark:placeholder-gray-500 px-3 py-1.5 " +
    "focus:outline-none focus:ring-2 focus:ring-gray-500/40";
  const textarea =
    "mt-1 w-full min-h-[96px] rounded-md border border-gray-300/40 dark:border-gray-700/60 " +
    "bg-white dark:bg-transparent text-gray-900 dark:text-gray-100 " +
    "placeholder-gray-400 dark:placeholder-gray-500 px-3 py-1.5 " +
    "focus:outline-none focus:ring-2 focus:ring-gray-500/40";
  const btn =
    "inline-flex items-center rounded-xl border border-gray-300/60 dark:border-gray-700 " +
    "px-4 py-2 text-sm font-medium " +
    "text-gray-900 dark:text-gray-100 " +
    "transition-colors " +
    "hover:bg-gray-100 hover:text-gray-900 " +
    "dark:hover:bg-gray-800 dark:hover:text-white " +
    "disabled:opacity-50";

  const warn =
    !adminSecret
      ? "Admin secret missing. Set NEXT_PUBLIC_ADMIN_SECRET in .env.local to match ADMIN_SECRET, then restart dev."
      : "";

  return (
    <main className="p-6 max-w-5xl mx-auto">
      {/* Header + Back link */}
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rules</h1>
        <Link href="/dashboard" className={btn} aria-label="Back to Dashboard">
          Back to Dashboard
        </Link>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        Create and prioritize matching rules. Lower priority numbers are evaluated first. Toggle rules on/off without deleting.
      </p>
      {warn && (
        <div className="mb-4 rounded-lg border border-amber-700/40 bg-amber-950/30 p-3 text-amber-200 text-sm">
          {warn}
        </div>
      )}

      {/* Form */}
      <div className={`${card} mb-8`}>
        <h2 className="text-lg font-medium mb-3">{id ? "Edit rule" : "Add rule"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm md:col-span-2">
            Pattern
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className={input}
              placeholder='e.g., "invoice", "/refund/i", or JSON criteria your matcher expects'
            />
          </label>
          <label className="block text-sm">
            Priority (optional)
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value === "" ? "" : Number(e.target.value))}
              className={input}
              placeholder="100"
            />
          </label>
          <label className="block text-sm">
            Mailbox ID (optional)
            <input
              value={mailboxId}
              onChange={(e) => setMailboxId(e.target.value)}
              className={input}
              placeholder="scope to mailbox (uuid)"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            Response (answer)
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className={textarea}
              placeholder="Auto-reply template or notes used by your engine."
            />
          </label>
          <label className="block text-sm">
            Active
            <select value={isActive ? "true" : "false"} onChange={(e) => setIsActive(e.target.value === "true")} className={input}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={save} disabled={saving || !pattern.trim() || !answer.trim()} className={btn}>
            {saving ? "Saving..." : "Save"}
          </button>
          {id && (
            <button onClick={clearForm} className={btn}>
              Cancel
            </button>
          )}
          <div className="text-sm text-gray-500 dark:text-gray-400 ml-auto">{result}</div>
        </div>
      </div>

      {/* List */}
      <div className={card}>
        <h2 className="text-lg font-medium mb-3">Configured rules</h2>
        {loading ? (
          <p>Loading…</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500">No rules yet.</p>
        ) : (
          <div className="divide-y divide-gray-200/40 dark:divide-gray-800/60">
            {items.map((r) => (
              <div key={r.id} className="py-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">{r.pattern}</div>
                  <div className="text-sm text-gray-500">
                    priority: {r.priority} • {r.mailbox_id ? `mailbox: ${r.mailbox_id} • ` : ""}
                    {"created " + new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "text-xs px-2 py-1 rounded-full " +
                      (r.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700")
                    }
                  >
                    {r.is_active ? "active" : "inactive"}
                  </span>
                  <button className={btn} onClick={() => toggleActive(r, !r.is_active)}>
                    {r.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button className={btn} onClick={() => edit(r)}>Edit</button>
                  <button className={btn} onClick={() => remove(r)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
