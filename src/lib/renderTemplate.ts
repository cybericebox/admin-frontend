// Client-side preview substitution mirroring the backend's Go text/html template
// rendering for {{.Var}} placeholders. NOT used for real delivery — preview only.
//
// - Known key  → its sample/value, escaped iff !opts.html.
// - Unknown key → highlighted token span, so a typo'd variable is visible.
// - opts.html=false (text fields: title/link/subject/preheader): escape literals
//   and values. opts.html=true (HTML body fields): pass author HTML through.
const PLACEHOLDER = /\{\{\s*\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  )
}

export function renderTemplate(
  tmpl: string,
  vars: Record<string, string>,
  opts: { html?: boolean } = {},
): string {
  const html = opts.html ?? false
  let out = ""
  let last = 0
  for (const m of tmpl.matchAll(PLACEHOLDER)) {
    const idx = m.index ?? 0
    const before = tmpl.slice(last, idx)
    out += html ? before : escapeHtml(before)
    const key = m[1]
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      out += html ? vars[key] : escapeHtml(vars[key])
    } else {
      out += `<span class="rounded bg-destructive/15 px-1 text-destructive">${escapeHtml(m[0])}</span>`
    }
    last = idx + m[0].length
  }
  const tail = tmpl.slice(last)
  out += html ? tail : escapeHtml(tail)
  return out
}
