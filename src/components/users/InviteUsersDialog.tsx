"use client"

import { useMemo, useRef, useState } from "react"
import { apiPost } from "@/api/client"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import EmailTagInput, { type EmailChip } from "./EmailTagInput"
import { SelectMenu } from "@/components/ui/select-menu"
import { parseEmails } from "@/lib/emailParse"
import { assignableRoles } from "@/lib/assignableRoles"
import { useRole, type Role } from "@/lib/useRole"
import { t } from "@/i18n/t"

interface InviteUsersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClosed?: () => void
}

type InviteResult = { Email: string; Error?: string }

function summary(text: string, n: { invited: number; skipped: number; failed: number }): string {
  return text
    .replace("{invited}", String(n.invited))
    .replace("{skipped}", String(n.skipped))
    .replace("{failed}", String(n.failed))
}

export default function InviteUsersDialog({ open, onOpenChange, onClosed }: InviteUsersDialogProps) {
  const { can } = useRole()
  const roles = useMemo(() => assignableRoles(can), [can])
  const [chips, setChips] = useState<EmailChip[]>([])
  const [role, setRole] = useState<Role | "">("")
  const [busy, setBusy] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [tally, setTally] = useState({ invited: 0, skipped: 0, failed: 0 })
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Derive the effective role each render: respect an explicit user choice, otherwise
  // default to the last (lowest-privilege) assignable role once roles load.
  const effectiveRole: Role | "" = role !== "" ? role : (roles.length > 0 ? roles[roles.length - 1] : "")

  const counts = useMemo(() => ({
    invited: chips.filter((c) => c.status === "invited").length,
    skipped: chips.filter((c) => c.status === "exists").length,
    failed: chips.filter((c) => c.status === "failed").length,
  }), [chips])

  const hasFailed = counts.failed > 0
  const canSubmit = chips.some((c) => c.status === "pending" || c.status === "failed") && effectiveRole !== "" && !busy

  async function send(targets: EmailChip[]) {
    if (targets.length === 0 || effectiveRole === "") return
    setBusy(true); setErrorKey(null)
    const emails = targets.map((c) => c.email)
    try {
      const results = await apiPost<InviteResult[]>("/api/users/invite", { Emails: emails, Role: effectiveRole })
      const byEmail = new Map<string, InviteResult>()
      for (const r of results ?? []) byEmail.set(r.Email.toLowerCase(), r)
      const outcomes = new Map<string, EmailChip>()
      for (const target of targets) {
        const r = byEmail.get(target.email.toLowerCase())
        if (!r) outcomes.set(target.email, { ...target, status: "failed", error: t("admin.users.invite.missingResult") })
        else if (!r.Error) outcomes.set(target.email, { ...target, status: "invited", error: undefined })
        else if (r.Error === "User already exists") outcomes.set(target.email, { ...target, status: "exists", error: undefined })
        else outcomes.set(target.email, { ...target, status: "failed", error: r.Error })
      }
      setChips((prev) => prev.map((chip) => outcomes.get(chip.email) ?? chip))
      setTally((previous) => ({
        invited: previous.invited + [...outcomes.values()].filter((chip) => chip.status === "invited").length,
        skipped: chips.filter((chip) => chip.status === "exists").length + [...outcomes.values()].filter((chip) => chip.status === "exists").length,
        failed: [...outcomes.values()].filter((chip) => chip.status === "failed").length,
      }))
      setSubmitted(true)
      // Drop the freshly-invited chips after a beat so the list stays focused on
      // what still needs attention (skipped/failed).
      dropTimerRef.current = setTimeout(() => {
        setChips((prev) => prev.filter((c) => c.status !== "invited"))
      }, 1500)
    } catch {
      setErrorKey("admin.users.invite.error")
    } finally {
      setBusy(false)
    }
  }

  function onSubmit() {
    const targets = chips.filter((c) => c.status === "pending" || c.status === "failed")
    // Reset prior failures to pending before re-sending so the mapping is clean.
    setChips((prev) => prev.map((c) => (c.status === "failed" ? { ...c, status: "pending", error: undefined } : c)))
    void send(targets.map((c) => ({ ...c, status: "pending" as const })))
  }

  function onCsvPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-picking the same file
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : ""
      const existing = new Set(chips.map((c) => c.email.toLowerCase()))
      const fresh = parseEmails(text).filter((em) => !existing.has(em.toLowerCase()))
      if (fresh.length > 0) {
        setChips((prev) => [...prev, ...fresh.map((email) => ({ email, status: "pending" as const }))])
      }
    }
    reader.onerror = () => setErrorKey("admin.users.invite.csvReadError")
    reader.readAsText(file)
  }

  function handleOpenChange(next: boolean) {
    if (!next && busy) return
    onOpenChange(next)
    if (!next) {
      if (dropTimerRef.current) { clearTimeout(dropTimerRef.current); dropTimerRef.current = null }
      setChips([]); setRole(""); setBusy(false); setErrorKey(null); setSubmitted(false); setTally({ invited: 0, skipped: 0, failed: 0 })
      onClosed?.()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.invite.title")}</DialogTitle>
          <DialogDescription>{t("admin.users.invite.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {submitted && (
            <p className="text-xs text-muted-foreground">{summary(t("admin.users.invite.summary"), tally)}</p>
          )}

          <EmailTagInput chips={chips} onChange={setChips} disabled={busy} />

          {chips.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("admin.users.invite.empty")}</p>
          )}

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={onCsvPicked}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              {t("admin.users.invite.importCsv")}
            </Button>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
              {t("admin.users.invite.roleLabel")}
            </label>
            <SelectMenu
              value={effectiveRole}
              onChange={(v) => setRole(v as Role)}
              options={roles.map((r) => ({ value: r, label: t(`admin.role.${r}`) }))}
              disabled={busy}
              className="w-full"
            />
          </div>

          {errorKey && (
            <Alert variant="destructive">
              <AlertDescription>{t(errorKey)}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            {submitted ? t("admin.users.invite.close") : t("admin.users.invite.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {hasFailed ? t("admin.users.invite.retry") : t("admin.users.invite.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
