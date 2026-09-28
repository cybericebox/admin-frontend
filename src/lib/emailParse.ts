// Shared email parsing for the invite flow. One parser feeds typed tags,
// clipboard paste, and CSV import so every entry path behaves identically.

// HTML5-level validation — deliberately permissive (the backend is the real
// authority). Rejects whitespace and obvious non-addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s)
}

// parseEmails turns arbitrary text (a single token, a pasted blob, or CSV file
// contents) into a clean, de-duplicated list of lowercase valid emails.
// Splits on any run of whitespace, commas, or semicolons — covering newlines,
// tabs, spaces, and CSV delimiters in one pass.
export function parseEmails(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/[\s,;]+/)) {
    const email = raw.trim().toLowerCase()
    if (!email || !isValidEmail(email) || seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}
