// src/app/tools/page.tsx
"use client";

import { useState } from "react";

export default function ToolsPage() {
  // ===== Unmatched digest =====
  const [sinceHours, setSinceHours] = useState<number>(24);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestResult, setDigestResult] = useState<string>("");

  // ===== Outbound preview (dev/prod formatting) =====
  const [provider, setProvider] = useState<"dev" | "prod">("dev");
  const [to, setTo] = useState<string>("");
  const [greetingName, setGreetingName] = useState<string>("David");
  const [msgBody, setMsgBody] = useState<string>(
    "This is our formatting preview from the Tools page."
  );
  const [origMsgId, setOrigMsgId] = useState<string>("prod-thread-check");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<string>("");

  // ===== Admin reply by Email ID (prod/dev) =====
  const [replyEmailId, setReplyEmailId] = useState<string>("");
  const [replyProvider, setReplyProvider] = useState<"dev" | "prod">("prod");
  const [replySubject, setReplySubject] = useState<string>("Re: Thanks for your note");
  const [replyBody, setReplyBody] = useState<string>("Appreciate the message—here is a formatted reply.");
  const [replyGreeting, setReplyGreeting] = useState<string>("David");
  const [replyOrigMsgId, setReplyOrigMsgId] = useState<string>("");
  const [replyToOverride, setReplyToOverride] = useState<string>("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyResult, setReplyResult] = useState<string>("");

  // ===== Quick-launch Admin Composer =====
  const [composeId, setComposeId] = useState<string>("");

  async function safeJson(res: Response) {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: res.ok, status: res.status, raw: text }; }
  }

  async function triggerDigest() {
    setDigestLoading(true);
    setDigestResult("");
    try {
      const res = await fetch("/api/run-unmatched-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sinceHours }),
      });
      const data = await safeJson(res);
      setDigestResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setDigestResult(`Error: ${String(e?.message || e)}`);
    } finally {
      setDigestLoading(false);
    }
  }

  async function sendPreview() {
    setPreviewLoading(true);
    setPreviewResult("");
    try {
      const res = await fetch("/api/run-send-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          to: to || undefined,
          greetingName: greetingName || undefined,
          body: msgBody,
          originalMessageId: origMsgId || undefined,
        }),
      });
      const data = await safeJson(res);
      setPreviewResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setPreviewResult(`Error: ${String(e?.message || e)}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function sendAdminReply() {
    setReplyLoading(true);
    setReplyResult("");
    try {
      const hdrs: Record<string, string> = { "Content-Type": "application/json" };
      const adminSecret = (process as any)?.env?.NEXT_PUBLIC_ADMIN_SECRET;
      if (adminSecret) hdrs["x-admin-secret"] = adminSecret as string;

      const res = await fetch("/api/admin/send-reply", {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          emailId: replyEmailId.trim(),
          provider: replyProvider,
          subject: replySubject || undefined,
          body: replyBody || undefined,
          greetingName: replyGreeting || undefined,
          originalMessageId: replyOrigMsgId || undefined,
          to: replyToOverride || undefined,
        }),
      });
      const data = await safeJson(res);
      setReplyResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setReplyResult(`Error: ${String(e?.message || e)}`);
    } finally {
      setReplyLoading(false);
    }
  }

  function openAdminComposer() {
    const id = composeId.trim();
    if (!id) return;
    // open in a new tab so you can keep Tools open
    window.open(`/admin/compose/${encodeURIComponent(id)}`, "_blank", "noopener,noreferrer");
  }

  const card =
    "rounded-2xl border border-gray-200/30 dark:border-gray-800/60 p-4";
  const input =
    "mt-1 w-full rounded-md border border-gray-300/40 dark:border-gray-700/60 " +
    "bg-white dark:bg-transparent text-gray-900 dark:text-gray-100 " +
    "placeholder-gray-400 dark:placeholder-gray-500 px-3 py-1.5 " +
    "focus:outline-none focus:ring-2 focus:ring-gray-500/40";
  const numInput = input + " w-32";
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
      <h1 className="text-2xl font-semibold mb-2">Tools</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Trigger operations safely; secrets are injected server-side.
      </p>

      {/* Unmatched Digest */}
      <div className={`${card} mb-8`}>
        <h2 className="text-lg font-medium mb-2">Unmatched Digest</h2>
        <label className="block text-sm mb-2">
          Lookback window (hours)
          <input
            type="number"
            min={1}
            max={240}
            value={sinceHours}
            onChange={(e) => setSinceHours(parseInt(e.target.value || "24", 10))}
            className={numInput}
          />
        </label>
        <button onClick={triggerDigest} disabled={digestLoading} className={btn}>
          {digestLoading ? "Sending..." : "Send unmatched digest now"}
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Calls <code>/api/alerts/unmatched-digest?sinceHours=...</code> on the server.
        </p>
        <div className={`${card} mt-4`}>
          <h3 className="text-sm font-medium mb-2">Result</h3>
          <pre className="text-xs whitespace-pre-wrap break-all">{digestResult}</pre>
        </div>
      </div>

      {/* Outbound Formatting Preview */}
      <div className={`${card} mb-8`}>
        <h2 className="text-lg font-medium mb-2">Outbound Formatting Preview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            Provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as "dev" | "prod")}
              className={input}
            >
              <option value="dev">dev (Mailtrap)</option>
              <option value="prod">prod (Postmark SMTP)</option>
            </select>
          </label>
          <label className="block text-sm">
            To (optional)
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@yourmail.com"
              className={input}
            />
          </label>
          <label className="block text-sm">
            Greeting name
            <input
              value={greetingName}
              onChange={(e) => setGreetingName(e.target.value)}
              className={input}
            />
          </label>
          <label className="block text-sm">
            In-Reply-To (MessageID, optional)
            <input
              value={origMsgId}
              onChange={(e) => setOrigMsgId(e.target.value)}
              placeholder="original MessageID for threading"
              className={input}
            />
          </label>
        </div>
        <label className="block text-sm mt-4">
          Body
          <textarea
            value={msgBody}
            onChange={(e) => setMsgBody(e.target.value)}
            rows={4}
            className={input}
          />
        </label>
        <button onClick={sendPreview} disabled={previewLoading} className={`${btn} mt-3`}>
          {previewLoading ? "Sending..." : "Send preview email"}
        </button>
        <div className={`${card} mt-4`}>
          <h3 className="text-sm font-medium mb-2">Result</h3>
          <pre className="text-xs whitespace-pre-wrap break-all">{previewResult}</pre>
        </div>
      </div>

      {/* Admin Reply by Email ID */}
      <div className={`${card} mb-8`}>
        <h2 className="text-lg font-medium mb-2">Admin Reply (by Email ID)</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            Email ID (UUID from <code>emails</code> table)
            <input
              value={replyEmailId}
              onChange={(e) => setReplyEmailId(e.target.value)}
              placeholder="e.g. 241a5595-ace2-45a1-9855-dcbe89ad19c4"
              className={input}
            />
          </label>

          <label className="block text-sm">
            Provider
            <select
              value={replyProvider}
              onChange={(e) => setReplyProvider(e.target.value as "dev" | "prod")}
              className={input}
            >
              <option value="dev">dev (Mailtrap)</option>
              <option value="prod">prod (Postmark SMTP)</option>
            </select>
          </label>

          <label className="block text-sm">
            Subject
            <input
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
              className={input}
            />
          </label>

          <label className="block text-sm">
            Greeting name
            <input
              value={replyGreeting}
              onChange={(e) => setReplyGreeting(e.target.value)}
              className={input}
            />
          </label>

          <label className="block text-sm">
            In-Reply-To (MessageID, optional)
            <input
              value={replyOrigMsgId}
              onChange={(e) => setReplyOrigMsgId(e.target.value)}
              placeholder="original MessageID for threading"
              className={input}
            />
          </label>

          <label className="block text-sm">
            To override (optional)
            <input
              value={replyToOverride}
              onChange={(e) => setReplyToOverride(e.target.value)}
              placeholder="override recipient (else uses emails.from_email)"
              className={input}
            />
          </label>
        </div>

        <label className="block text-sm mt-4">
          Body
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={4}
            className={input}
          />
        </label>

        <button onClick={sendAdminReply} disabled={replyLoading} className={`${btn} mt-3`}>
          {replyLoading ? "Sending..." : "Send admin reply"}
        </button>

        <div className={`${card} mt-4`}>
          <h3 className="text-sm font-medium mb-2">Result</h3>
          <pre className="text-xs whitespace-pre-wrap break-all">{replyResult}</pre>
        </div>
      </div>

      {/* Quick-launch Admin Composer */}
      <div className={card}>
        <h2 className="text-lg font-medium mb-2">Quick-launch Admin Composer</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Paste an <code>emails.id</code> and open <code>/admin/compose/:id</code> in a new tab.
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm">
              Email ID (UUID)
              <input
                value={composeId}
                onChange={(e) => setComposeId(e.target.value)}
                placeholder="e.g. 241a5595-ace2-45a1-9855-dcbe89ad19c4"
                className={input}
              />
            </label>
          </div>
          <button onClick={openAdminComposer} className={btn}>
            Open composer
          </button>
        </div>
      </div>
    </main>
  );
}
