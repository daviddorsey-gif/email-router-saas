// src/app/admin/emails/[id]/ReplyForm.tsx
"use client";

import { useState } from "react";

export default function ReplyForm({
  emailId,
  toDefault,
  subjectDefault,
  adminSecret,
}: {
  emailId: string;
  toDefault: string;
  subjectDefault: string;
  adminSecret?: string;
}) {
  const [to, setTo] = useState<string>(toDefault);
  const [subject, setSubject] = useState<string>(subjectDefault);
  const [text, setText] = useState<string>("");
  const [html, setHtml] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string>("");

  function buildInit(body: any): RequestInit {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // Optional: include admin secret if you’ve set ADMIN_SECRET on the server
    if (adminSecret) headers["x-admin-secret"] = adminSecret;
    return { method: "POST", headers, body: JSON.stringify(body) };
  }
  function withSecretQS(path: string) {
    if (!adminSecret) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}admin_secret=${encodeURIComponent(adminSecret)}`;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult("");
    try {
      // Backward/forward compatible payload:
      // - always send emailId
      // - send both text/html if provided; route normalizes
      const body: any = {
        emailId,            // legacy key
        email_id: emailId,  // new key
        to: to.trim() || undefined,
        subject: subject.trim() || undefined,
      };
      if (html.trim()) body.html = html.trim();
      if (text.trim()) body.text = text.trim();
      if (!body.html && !body.text) {
        setResult("Error: Provide Text and/or HTML.");
        setSending(false);
        return;
      }

      const res = await fetch(withSecretQS("/api/reply"), buildInit(body));
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setResult(`Sent. messageId=${data.messageId} (${data.provider})`);
    } catch (err: any) {
      setResult(`Error: ${String(err?.message || err)}`);
    } finally {
      setSending(false);
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
    "mt-1 w-full min-h-[120px] rounded-md border border-gray-300/40 dark:border-gray-700/60 " +
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
    <div className={card}>
      <h2 className="text-lg font-medium mb-3">Reply to sender</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
        <label className="block text-sm">
          To
          <input value={to} onChange={(e) => setTo(e.target.value)} className={input} placeholder="user@example.com" />
        </label>
        <label className="block text-sm">
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} placeholder="Re: Your inquiry" />
        </label>
        <label className="block text-sm">
          Text (optional)
          <textarea value={text} onChange={(e) => setText(e.target.value)} className={textarea} placeholder="Plain text body" />
        </label>
        <label className="block text-sm">
          HTML (optional)
          <textarea value={html} onChange={(e) => setHtml(e.target.value)} className={textarea} placeholder="<p>HTML body</p>" />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className={btn} disabled={sending || (!text && !html)}>
            {sending ? "Sending..." : "Send reply"}
          </button>
          <div className="text-sm text-gray-500 dark:text-gray-400">{result}</div>
        </div>
      </form>
    </div>
  );
}
