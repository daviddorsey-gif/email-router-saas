// src/lib/personalize.ts

// --- Public helpers ---------------------------------------------------------

/** Prefer a name from the body/signature; fallback to email handle; else "there". */
export function chooseSalutationName(opts: {
  from_email?: string | null;
  body?: string | null;
  snippet?: string | null;
}) {
  const bodyOrSnippet = opts.body || opts.snippet || null;
  const fromBody = nameFromBody(bodyOrSnippet);
  if (fromBody) return fromBody;
  return firstNameFromEmail(opts.from_email) || 'there';
}

/** Very simple {{token}} template renderer. */
export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v != null ? v : '';
  });
}

/** Default reply if no rule template is available. */
export function defaultReply({ salutationName }: { salutationName: string }) {
  const name = salutationName || 'there';
  return `Hi ${name},

Thanks for reaching out—here’s an update...

Best,
Support Team`;
}

// --- Name extraction logic ---------------------------------------------------

/**
 * Try to extract a likely human name from the email body/signature.
 * Handles:
 *   "Thanks,\nDavid"
 *   "Thanks, David"
 *   "Best - David"
 *   "Regards David"
 * Also falls back to the last short line that looks like a name.
 */
export function nameFromBody(body: string | null | undefined): string | null {
  if (!body) return null;

  const text = body.replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1) Same-line sign-off + name, e.g., "Thanks, David" or "Best - David"
  //    Also supports "Regards David" (no comma).
  const inlineCue = new RegExp(
    String.raw`(?:^|\s)(thanks|thank you|regards|best|cheers|sincerely|warmly|yours|kind regards)\s*[,!\-–—:]?\s*([A-Za-z][A-Za-z.'\-]*(?:\s+[A-Za-z][A-Za-z.'\-]*){0,2})\s*$`,
    'i'
  );
  for (const l of lines.slice(-6)) { // scan last few lines
    const m = l.match(inlineCue);
    if (m && isLikelyHumanName(m[2])) return normalizeName(m[2]);
  }

  // 2) Cue line then next-line name, e.g., "Thanks," then "David"
  const cueOnly = /^(thanks|thank you|regards|best|cheers|sincerely|warmly|yours|kind regards)[,!\-–—:]?$/i;
  for (let i = 0; i < lines.length; i++) {
    if (cueOnly.test(lines[i])) {
      const next = lines[i + 1]?.replace(/^[-–—]\s*/, '').trim(); // allow "- David"
      if (next && isLikelyHumanName(next)) return normalizeName(next);
    }
  }

  // 3) Fallback: last short line that looks like a name
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].replace(/^[-–—]\s*/, '').trim();
    if (isLikelyHumanName(l)) return normalizeName(l);
  }

  // 4) Wide fallback: search the tail of the text for "cue ... Name"
  const tail = text.split('\n').slice(-8).join('\n');
  const tailMatch = tail.match(
    /(thanks|thank you|regards|best|cheers|sincerely|warmly|yours|kind regards)[,!\s\-–—:]*([A-Za-z][A-Za-z.'\-]*(?:\s+[A-Za-z][A-Za-z.'\-]*){0,2})/i
  );
  if (tailMatch && isLikelyHumanName(tailMatch[2])) return normalizeName(tailMatch[2]);

  return null;
}

/** Conservative fallback from email handle (rejects digit-heavy/weird handles). */
export function firstNameFromEmail(email: string | null | undefined) {
  if (!email) return 'there';
  const [local] = email.split('@');
  if (!local) return 'there';

  // Reject: starts non-letter or contains 2+ consecutive digits
  if (!/^[A-Za-z]/.test(local) || /\d{2,}/.test(local)) return 'there';

  const base = local.replace(/[._-]+/g, ' ').trim();
  const first = base.split(' ')[0];
  if (!first) return 'there';

  if (!/^[A-Za-z]{2,20}$/.test(first)) return 'there';

  return capitalize(first);
}

// --- small helpers -----------------------------------------------------------

function isLikelyHumanName(s: string) {
  if (!s) return false;
  if (s.length > 60) return false;
  if (/\S+@\S+/.test(s)) return false;    // email addresses
  if (/[0-9]{3,}/.test(s)) return false;  // 3+ consecutive digits
  // 1–3 words, letters + allowed punctuation
  return /^[A-Za-z][A-Za-z.'\-]*(?:\s+[A-Za-z][A-Za-z.'\-]*){0,2}$/.test(s);
}

function normalizeName(s: string) {
  return s
    .split(/\s+/)
    .map(capitalize)
    .join(' ');
}

function capitalize(word: string) {
  return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : '';
}
