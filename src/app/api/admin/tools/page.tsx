// src/app/tools/page.tsx
"use client";

import { useState } from "react";

export default function ToolsPage() {
  const [sinceHours, setSinceHours] = useState<number>(24);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  async function triggerDigest() {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/run-unmatched-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sinceHours }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResult(`Error: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Tools</h1>
      <p className="text-sm text-gray-500 mb-6">
        Run the unmatched digest on demand. This calls a server proxy that injects secrets.
      </p>

      <div className="rounded-2xl border border-gray-200 p-4 mb-6">
        <h2 className="text-lg font-medium mb-2">Unmatched Digest</h2>
        <label className="block text-sm mb-2">
          Lookback window (hours)
          <input
            type="number"
            min={1}
            max={240}
            value={sinceHours}
            onChange={(e) => setSinceHours(parseInt(e.target.value || "24", 10))}
            className="mt-1 w-32 rounded-md border px-3 py-1.5"
          />
        </label>
        <button
          onClick={triggerDigest}
          disabled={loading}
          className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send unmatched digest now"}
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Calls <code>/api/alerts/unmatched-digest?sinceHours=...</code> on the server.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 p-4">
        <h3 className="text-sm font-medium mb-2">Result</h3>
        <pre className="text-xs whitespace-pre-wrap break-all">{result}</pre>
      </div>
    </main>
  );
}
