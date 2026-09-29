// CSV import for platform invitations: email (required), first_name,
// last_name, role. Columns are matched by their English header name (any
// case, any order); unknown columns are ignored; issues carry the file row.
import type { Role } from "@/lib/useRole"
import { isValidEmail } from "@/lib/emailParse"

export type CsvIssueCode = "empty" | "missingColumn" | "missingEmail" | "invalidEmail" | "invalidRole" | "roleForbidden"
export type CsvIssue = { row: number; code: CsvIssueCode; column?: string; value?: string }
export type UserInviteEntry = { email: string; firstName: string; lastName: string; role?: Role; row: number }

export const userInviteColumns = ["email", "first_name", "last_name", "role"] as const
export const knownRoles: readonly Role[] = ["user", "admin_viewer", "admin", "super_admin"]

type Line = { row: number; cells: string[] }

// Splits CSV text into rows, honouring quotes ("" escapes, line breaks inside
// quotes). Comma-delimited, or semicolon when the header uses semicolons.
export function readCsvLines(source: string): Line[] {
  const text = source.replace(/^\uFEFF/, "")
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ","
  const lines: Line[] = []
  let cells: string[] = []
  let cell = ""
  let quoted = false
  let row = 1
  let rowStart = 1
  const push = () => {
    cells.push(cell.trim())
    if (cells.some(Boolean)) lines.push({ row: rowStart, cells })
    cells = []
    cell = ""
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim())
      cell = ""
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++
      push()
      row++
      rowStart = row
    } else {
      if (char === "\n") row++
      cell += char
    }
  }
  push()
  return lines
}

// assignable: the roles the caller may grant (an admin cannot grant above
// their own rights); an empty role cell means the dialog's default role.
export function parseUserInviteCsv(source: string, assignable: readonly Role[]): { entries: UserInviteEntry[]; issues: CsvIssue[] } {
  const lines = readCsvLines(source)
  if (lines.length === 0) return { entries: [], issues: [{ row: 1, code: "empty" }] }
  const [header, ...data] = lines
  const index = new Map<string, number>()
  header.cells.forEach((name, position) => {
    const key = name.trim().toLowerCase()
    if (key && !index.has(key)) index.set(key, position)
  })
  if (!index.has("email")) return { entries: [], issues: [{ row: header.row, code: "missingColumn", column: "email" }] }
  if (data.length === 0) return { entries: [], issues: [{ row: header.row, code: "empty" }] }
  const get = (line: Line, column: string) => {
    const position = index.get(column)
    return position === undefined ? "" : (line.cells[position] ?? "").trim()
  }
  const entries: UserInviteEntry[] = []
  const issues: CsvIssue[] = []
  const seen = new Set<string>()
  for (const line of data) {
    const email = get(line, "email").toLowerCase()
    const rawRole = get(line, "role").toLowerCase()
    if (!email) { issues.push({ row: line.row, code: "missingEmail" }); continue }
    if (!isValidEmail(email)) { issues.push({ row: line.row, code: "invalidEmail", value: email }); continue }
    if (rawRole && !knownRoles.includes(rawRole as Role)) { issues.push({ row: line.row, code: "invalidRole", value: rawRole }); continue }
    if (rawRole && !assignable.includes(rawRole as Role)) { issues.push({ row: line.row, code: "roleForbidden", value: rawRole }); continue }
    if (seen.has(email)) continue
    seen.add(email)
    entries.push({ email, firstName: get(line, "first_name"), lastName: get(line, "last_name"), role: rawRole ? rawRole as Role : undefined, row: line.row })
  }
  return { entries, issues }
}

export function csvTemplate(columns: readonly string[], example: readonly string[]): string {
  const quote = (value: string) => /[",;\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
  return `\uFEFF${columns.join(",")}\r\n${example.map(quote).join(",")}\r\n`
}
