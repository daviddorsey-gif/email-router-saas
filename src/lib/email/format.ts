// src/lib/email/format.ts

type Brand = { name: string; logoUrl?: string };
type Common = {
  subject: string;
  greetingName: string;
  body: string;
  brand: Brand;
};

type ReplyHeaderInput = {
  originalMessageId?: string;
  listUnsubUrl?: string;     // e.g. https://yourhost/api/unsubscribe
  listUnsubMailto?: string;  // e.g. mailto:unsubscribe@yourdomain?subject=unsubscribe
};

export function renderHtml({ subject, greetingName, body, brand }: Common) {
  const safeBrand = brand?.name || "Support";
  const logo = brand?.logoUrl
    ? `<img src="${brand.logoUrl}" alt="${safeBrand}" height="32" style="display:block;margin-bottom:12px;" />`
    : "";

  // Inline, visible unsubscribe footer (optional via env)
  const showFooter = (process.env.LIST_UNSUB_FOOTER || "").toLowerCase() === "true";
  const displayUrl =
    process.env.LIST_UNSUB_DISPLAY_URL ||
    process.env.LIST_UNSUB_URL_BASE ||  // fallback to the RFC 8058 URL if no display URL set
    "";
  const displayMailto = process.env.LIST_UNSUB_MAILTO || "";
  const footerHtml = showFooter
    ? visibleUnsubHtml(displayUrl, displayMailto, safeBrand)
    : "";

  return String.raw`<!doctype html>
<html>
  <head>
    <meta charSet="utf-8" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:24px;">
            <tr><td>
              ${logo}
              <h1 style="font:600 18px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0 0 12px;">
                ${escapeHtml(safeBrand)}
              </h1>
              <p style="font:14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;margin:16px 0;">
                Hi ${escapeHtml(greetingName)},
              </p>
              <p style="font:14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;margin:12px 0;">
                ${escapeHtml(body)}
              </p>
              <p style="font:13px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6b7280;margin:24px 0 0;">
                — ${escapeHtml(safeBrand)}
              </p>
              ${footerHtml}
            </td></tr>
          </table>
          <div style="color:#9ca3af;font:12px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin-top:12px;">
            You received this because you contacted ${escapeHtml(safeBrand)}.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderText({ subject, greetingName, body, brand }: Common) {
  const safeBrand = brand?.name || "Support";

  // Visible footer in text as well (optional)
  const showFooter = (process.env.LIST_UNSUB_FOOTER || "").toLowerCase() === "true";
  const displayUrl =
    process.env.LIST_UNSUB_DISPLAY_URL ||
    process.env.LIST_UNSUB_URL_BASE ||
    "";
  const displayMailto = process.env.LIST_UNSUB_MAILTO || "";
  const footerText = showFooter ? visibleUnsubText(displayUrl, displayMailto, safeBrand) : "";

  return [
    `${safeBrand}`,
    "",
    `Hi ${greetingName},`,
    "",
    body,
    "",
    `— ${safeBrand}`,
    footerText && "",
    footerText,
  ].filter(Boolean).join("\n");
}

export function buildReplyHeaders(input: ReplyHeaderInput) {
  const headers: Record<string, string> = {
    "Auto-Submitted": "auto-replied",
    "X-Auto-Response-Suppress": "All",
    Precedence: "bulk",
  };

  if (input?.originalMessageId) {
    headers["In-Reply-To"] = `<${trimAngles(input.originalMessageId)}>`;
    headers["References"] = `<${trimAngles(input.originalMessageId)}>`;
  }

  const parts: string[] = [];
  if (input?.listUnsubUrl) {
    parts.push(`<${input.listUnsubUrl}>`);
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"; // RFC 8058
  }
  if (input?.listUnsubMailto) {
    parts.push(`<${input.listUnsubMailto}>`);
  }
  if (parts.length) {
    headers["List-Unsubscribe"] = parts.join(", ");
  }

  return headers;
}

// ---- helpers ----
function escapeHtml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function trimAngles(s: string) {
  return String(s).replace(/^<+/, "").replace(/>+$/, "");
}
function visibleUnsubHtml(url: string, mailto: string, brand: string) {
  // pick best available link
  const link = url || mailto || "";
  if (!link) return "";
  const mailtoLine = mailto ? ` or <a href="${mailto}" target="_blank" style="color:#6b7280;text-decoration:underline;">email us</a>` : "";
  return `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
    <p style="font:12px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6b7280;margin:0;">
      Don’t want these emails? <a href="${link}" target="_blank" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>${mailtoLine}.
    </p>
  `;
}
function visibleUnsubText(url: string, mailto: string, brand: string) {
  const parts = [];
  if (url) parts.push(`Unsubscribe: ${url}`);
  if (mailto) parts.push(`Or email: ${mailto}`);
  return parts.length ? parts.join("\n") : "";
}
