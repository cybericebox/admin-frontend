// A line diff of two template versions (docs/specs/ADMIN.md §6): each version becomes labelled text lines, the lines
// are compared with a longest-common-subsequence diff. Pure.
import type { EmailBodyBlock } from "./emailBlocks"

export type DiffLine = { kind: "same" | "added" | "removed"; text: string }

/** The plain text of a Lexical node tree (rich text blocks), one line per paragraph. */
function lexicalLines(node: unknown): string[] {
  const lines: string[] = []
  const walk = (current: unknown, inline: string[]) => {
    if (!current || typeof current !== "object") return
    const item = current as { type?: string; text?: string; children?: unknown[] }
    if (item.type === "text" && typeof item.text === "string") { inline.push(item.text); return }
    if (item.type === "linebreak") { inline.push("\n"); return }
    const block = item.type === "paragraph" || item.type === "heading" || item.type === "listitem" || item.type === "quote"
    const own: string[] = []
    for (const child of item.children ?? []) walk(child, block ? own : inline)
    if (block) lines.push(...own.join("").split("\n"))
  }
  const root = (node as { root?: unknown })?.root ?? node
  const top: string[] = []
  walk(root, top)
  if (top.length) lines.push(top.join(""))
  return lines.filter((line) => line.trim() !== "")
}

export function emailLines(version: { Subject: string; Preheader: string; Body: EmailBodyBlock[] }, label: { subject: string; preheader: string; button: string; image: string }): string[] {
  const lines = [`${label.subject}: ${version.Subject}`]
  if (version.Preheader) lines.push(`${label.preheader}: ${version.Preheader}`)
  for (const block of version.Body) {
    if (block.type === "rich_text") lines.push(...lexicalLines(block.content))
    else if (block.type === "button") lines.push(`${label.button}: ${block.label} → ${block.url}`)
    else if (block.type === "image") lines.push(`${label.image}: ${block.alt ?? ""} ${block.url ?? block.file_id ?? ""}`.trim())
  }
  return lines
}

export function inAppLines(version: { Title: string; Body: string; Link: string }, label: { title: string; link: string }): string[] {
  return [`${label.title}: ${version.Title}`, ...version.Body.split("\n").filter((line) => line.trim() !== ""), ...(version.Link ? [`${label.link}: ${version.Link}`] : [])]
}

/** What changes going from `from` to `to`: removed lines, added lines, the rest unchanged, in reading order. */
export function lineDiff(from: readonly string[], to: readonly string[]): DiffLine[] {
  const n = from.length
  const m = to.length
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) table[i][j] = from[i] === to[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (from[i] === to[j]) { out.push({ kind: "same", text: from[i] }); i += 1; j += 1 }
    else if (table[i + 1][j] >= table[i][j + 1]) { out.push({ kind: "removed", text: from[i] }); i += 1 }
    else { out.push({ kind: "added", text: to[j] }); j += 1 }
  }
  for (; i < n; i += 1) out.push({ kind: "removed", text: from[i] })
  for (; j < m; j += 1) out.push({ kind: "added", text: to[j] })
  return out
}
