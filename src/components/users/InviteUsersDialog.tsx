"use client"

import { useId, useMemo, useRef, useState } from "react"
import { apiPost } from "@/api/client"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FieldHelp } from "@/components/ui/field-help"
import { FilePicker } from "@/components/ui/file-picker"
import { toast } from "@/components/ui/toast"
import EmailTagInput, { addChips, type EmailChip } from "./EmailTagInput"
import { SelectMenu } from "@/components/ui/select-menu"
import { assignableRoles } from "@/lib/assignableRoles"
import { csvTemplate, knownRoles, parseUserInviteCsv, userInviteColumns, type CsvIssue } from "@/lib/inviteCsv"
import { useRole, type Role } from "@/lib/useRole"
import { roleLabel } from "@/lib/roles"
import { t } from "@/i18n/t"

interface InviteUsersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClosed?: () => void
}

type InviteResult = { Email: string; Role?: Role; Code?: string }

const INVITE_LIMIT = 200

function csvIssueText(issue: CsvIssue): string {
  return t("admin.users.invite.csv.row", {
    row: issue.row,
    message: t(`admin.users.invite.csv.issue.${issue.code}`, { column: issue.column ?? "", value: issue.value ?? "" }),
  })
}

function downloadTemplate() {
  const content = csvTemplate(userInviteColumns, [[t("admin.users.invite.template.email"), t("admin.users.invite.template.firstName"), t("admin.users.invite.template.lastName"), "user"]])
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = t("admin.users.invite.template.file")
  link.click()
  URL.revokeObjectURL(url)
}

// Platform invitations: addresses as chips and/or a CSV with email,
// first_name, last_name, role. A CSV role overrides the default role below;
// the server re-checks every role against the caller's rights.
export default function InviteUsersDialog({ open, onOpenChange, onClosed }: InviteUsersDialogProps) {
  const id = useId()
  const { can } = useRole()
  const roles = useMemo(() => assignableRoles(can), [can])
  const [chips, setChips] = useState<EmailChip[]>([])
  const [role, setRole] = useState<Role | "">("")
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [csvIssues, setCsvIssues] = useState<CsvIssue[]>([])
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derive the effective role each render: respect an explicit user choice, otherwise
  // default to the last (lowest-privilege) assignable role once roles load.
  const effectiveRole: Role | "" = role !== "" ? role : (roles.length > 0 ? roles[roles.length - 1] : "")

  const invalidCount = chips.filter((c) => c.status === "invalid").length
  const sendable = chips.filter((c) => c.status === "pending" || c.status === "failed")
  const hasFailed = chips.some((c) => c.status === "failed")
  const canSubmit = sendable.length > 0 && sendable.length <= INVITE_LIMIT && invalidCount === 0 && effectiveRole !== "" && !busy

  async function send(targets: EmailChip[]) {
    if (targets.length === 0 || effectiveRole === "") return
    setBusy(true)
    try {
      const results = await apiPost<InviteResult[]>("/api/users/invite", {
        Entries: targets.map((c) => ({ Email: c.email, FirstName: c.firstName ?? "", LastName: c.lastName ?? "", Role: c.role ?? effectiveRole })),
      })
      const byEmail = new Map<string, InviteResult>()
      for (const r of results ?? []) byEmail.set(r.Email.toLowerCase(), r)
      const outcomes = new Map<string, EmailChip>()
      for (const target of targets) {
        const r = byEmail.get(target.email.toLowerCase())
        if (!r) outcomes.set(target.email, { ...target, status: "failed", error: t("admin.users.invite.missingResult") })
        else if (!r.Code) outcomes.set(target.email, { ...target, status: "invited", error: undefined })
        else if (r.Code === "user_exists") outcomes.set(target.email, { ...target, status: "exists", error: undefined })
        else outcomes.set(target.email, { ...target, status: "failed", error: t(`admin.users.invite.code.${r.Code}`) })
      }
      setChips((prev) => prev.map((chip) => outcomes.get(chip.email) ?? chip))
      const counts = {
        invited: [...outcomes.values()].filter((chip) => chip.status === "invited").length,
        skipped: [...outcomes.values()].filter((chip) => chip.status === "exists").length,
        failed: [...outcomes.values()].filter((chip) => chip.status === "failed").length,
      }
      const resultMessage = t("admin.users.invite.summary", counts)
      if (counts.failed > 0 && counts.invited === 0) toast.error(resultMessage)
      else if (counts.failed > 0 || counts.skipped > 0) toast.warning(resultMessage)
      else toast.success(resultMessage)
      setSubmitted(true)
      // Drop the freshly-invited chips after a beat so the list stays focused on
      // what still needs attention (skipped/failed).
      dropTimerRef.current = setTimeout(() => {
        setChips((prev) => prev.filter((c) => c.status !== "invited"))
      }, 1500)
    } catch {
      toast.error(t("admin.users.invite.error"))
    } finally {
      setBusy(false)
    }
  }

  function onSubmit() {
    // Reset prior failures to pending before re-sending so the mapping is clean.
    setChips((prev) => prev.map((c) => (c.status === "failed" ? { ...c, status: "pending", error: undefined } : c)))
    void send(sendable.map((c) => ({ ...c, status: "pending" as const })))
  }

  async function onFile(file: File | null) {
    if (!file) { setFileName(null); setCsvIssues([]); return }
    setFileName(file.name)
    try {
      const { entries, issues } = parseUserInviteCsv(await file.text(), roles)
      setCsvIssues(issues)
      setChips((prev) => addChips(prev, entries))
    } catch {
      setCsvIssues([])
      toast.error(t("admin.users.invite.csvReadError"))
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && busy) return
    onOpenChange(next)
    if (!next) {
      if (dropTimerRef.current) { clearTimeout(dropTimerRef.current); dropTimerRef.current = null }
      setChips([]); setRole(""); setBusy(false); setSubmitted(false); setFileName(null); setCsvIssues([])
      onClosed?.()
    }
  }

  const columnsHelp = [t("admin.users.invite.csv.columnsIntro"), ...userInviteColumns.map((column) => `• ${column === "email" ? t("admin.users.invite.csv.columnRequired", { column }) : column}`), t("admin.users.invite.csv.columnsNote", { roles: knownRoles.join(", ") })].join("\n")

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.invite.title")}</DialogTitle>
          <DialogDescription>{t("admin.users.invite.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`${id}-emails`} className="text-sm font-medium">
              {t("admin.users.invite.emailsLabel")} <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <EmailTagInput id={`${id}-emails`} chips={chips} onChange={setChips} disabled={busy} describedBy={`${id}-hint`} />
            <p id={`${id}-hint`} className={invalidCount > 0 || sendable.length > INVITE_LIMIT ? "text-xs text-destructive" : "text-xs text-muted-foreground"} role={invalidCount > 0 ? "alert" : undefined}>
              {invalidCount > 0
                ? t("admin.users.invite.invalidCount", { count: invalidCount })
                : sendable.length > INVITE_LIMIT
                  ? t("admin.users.invite.limit", { limit: INVITE_LIMIT })
                  : t("admin.users.invite.counter", { count: sendable.length, limit: INVITE_LIMIT })}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <label htmlFor={`${id}-csv`} className="text-sm font-medium">{t("admin.users.invite.csv.label")}</label>
                <FieldHelp text={columnsHelp} />
              </div>
              <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={downloadTemplate}>{t("admin.users.invite.csv.template")}</Button>
            </div>
            <FilePicker id={`${id}-csv`} fileName={fileName} onFile={(file) => void onFile(file)} accept=".csv,text/csv" disabled={busy} describedBy={csvIssues.length ? `${id}-csv-issues` : undefined} />
            {csvIssues.length > 0 && (
              <ul id={`${id}-csv-issues`} role="alert" className="max-h-40 space-y-0.5 overflow-auto text-xs text-destructive">
                {csvIssues.slice(0, 50).map((issue, index) => <li key={index}>{csvIssueText(issue)}</li>)}
                {csvIssues.length > 50 && <li>{t("admin.users.invite.csv.more", { count: csvIssues.length - 50 })}</li>}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("admin.users.invite.roleLabel")}</label>
            <SelectMenu
              value={effectiveRole}
              onChange={(v) => setRole(v as Role)}
              options={roles.map((r) => ({ value: r, label: roleLabel(r) }))}
              disabled={busy}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">{t("admin.users.invite.roleHint")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            {submitted ? t("admin.users.invite.close") : t("admin.users.invite.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit} busy={busy}>
            {hasFailed ? t("admin.users.invite.retry") : t("admin.users.invite.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
