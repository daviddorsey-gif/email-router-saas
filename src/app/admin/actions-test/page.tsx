"use client";

import { useState } from "react";

export default function ActionsTestPage() {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sendTest() {
    setSending(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/test-alert", { method: "POST" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg(`Error: ${data.error ?? `HTTP ${r.status}`}`);
      } else {
        const mode = data.mode ?? "unknown";
        setMsg(`OK: alert sent via ${mode}${data.dryrun ? " (dryrun)" : ""}`);
      }
    } catch (e: any) {
      setMsg(`Error: ${e?.message ?? "request failed"}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-10">
      <h1 className="text-xl font-semibold mb-4">Actions Test</h1>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); sendTest(); }}
        className="rounded-lg bg-slate-100 px-4 py-2 text-slate-900 hover:bg-white"
        disabled={sending}
      >
        {sending ? "Sending..." : "Send test alert"}
      </button>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
      <p className="mt-6 text-xs text-slate-400">
        This page has no Links. You should see a <strong>POST</strong> to <code>/api/admin/test-alert</code> in Network.
      </p>
    </div>
  );
}
