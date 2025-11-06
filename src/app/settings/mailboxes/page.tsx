// src/app/settings/mailboxes/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link"; // ← added

type Mailbox = {
  id: string;
  label: string;
  address: string;
  stream: string;
  enabled: boolean;
  created_at: string;
};

export default function MailboxesSettingsPage() {
  const [items, setItems] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // form
  const [id, setId] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [stream, setStream] = useState<string>("support");
  const [enabled, setEnabled] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string>("");

  const adminSecret =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_ADMIN_SECRET as string | undefined)
      : undefined;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/mailboxes", {
        headers: { ...(adminSecret ? { "x-admin-secret": adminSecret } : {}) },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setItems(data.mailboxes || []);
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
    setLabel("");
    setAddress("");
    setStream("support");
    setEnabled(true);
    setResult("");
  }

  function edit(mb: Mailbox) {
    setId(mb.id);
    setLabel(mb.label);
    setAddress(mb.address);
    setStream(mb.stream || "support");
    setEnabled(!!mb.enabled);
    setResult("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setSaving(true);
    setResult("");
    try {
      const res = await fetch("/api/admin/mailboxes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminSecret ? { "x-admin-secret": adminSecret } : {}),
        },
        body: JSON.stringify({
          action: "upsert",
          id: id || undefined,
          label,
          address,
          stream,
          enabled,
        }),
      });
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

  async function toggleEnabled(mb: Mailbox, next: boolean) {
    try {
      const res = await fetch("/api/admin/mailboxes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminSecret ? { "x-admin-secret": adminSecret } : {}),
        },
        body: JSON.stringify({ action: "toggle", id: mb.id, enabled: next }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      await load();
    } catch (e) {
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
  const btn =
    "inline-flex items-center rounded-xl border border-gray-300/60 dark:border-gray-700 " +
    "px-4 py-2 text-sm font-medium " +
    "text-gray-900 dark:text-gray-100 " +
    "transition-colors " +
    "hover:bg-gray-100 hover:text-gray-900 " +
    "dark:hover:bg-gray-800 dark:hover:text-white " +
    "disabled:opacity-50";

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {/* Header + Back link */}
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mailboxes</h1>
        <Link href="/dashboard" className={btn} aria-label="Back to Dashboard">
          Back to Dashboard
        </Link>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Define addresses like <code>faq@</code> or <code>support@</code> for routing. This settings page is admin-only.
      </p>

      {/* Form */}
      <div className={`${card} mb-8`}>
        <h2 className="text-lg font-medium mb-3">{id ? "Edit mailbox" : "Add mailbox"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            Label
            <input value={label} onChange={(e) => setLabel(e.target.value)} className={input} placeholder="FAQ" />
          </label>
          <label className="block text-sm">
            Address
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={input}
              placeholder="faq@yourdomain.com"
            />
          </label>
          <label className="block text-sm">
            Stream (optional)
            <input
              value={stream}
              onChange={(e) => setStream(e.target.value)}
              className={input}
              placeholder="support"
            />
          </label>
          <label className="block text-sm">
            Enabled
            <select value={enabled ? "true" : "false"} onChange={(e) => setEnabled(e.target.value === "true")} className={input}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={save} disabled={saving} className={btn}>
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
        <h2 className="text-lg font-medium mb-3">Configured mailboxes</h2>
        {loading ? (
          <p>Loading…</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500">No mailboxes yet.</p>
        ) : (
          <div className="divide-y divide-gray-200/40 dark:divide-gray-800/60">
            {items.map((mb) => (
              <div key={mb.id} className="py-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">{mb.label}</div>
                  <div className="text-sm text-gray-500">
                    {mb.address} • stream: {mb.stream || "support"} • created {new Date(mb.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "text-xs px-2 py-1 rounded-full " +
                      (mb.enabled ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700")
                    }
                  >
                    {mb.enabled ? "enabled" : "disabled"}
                  </span>
                  <button className={btn} onClick={() => toggleEnabled(mb, !mb.enabled)}>
                    {mb.enabled ? "Disable" : "Enable"}
                  </button>
                  <button className={btn} onClick={() => edit(mb)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
