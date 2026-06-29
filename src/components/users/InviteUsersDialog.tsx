"use client"

import { useMemo, useState } from "react"
import { apiPost } from "@/api/client"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import EmailTagInput, { type EmailChip } from "./EmailTagInput"
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
  const [error, setError] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Derive the effective role each render: respect an explicit user choice, otherwise
  // default to the last (lowest-privilege) assignable role once roles load.
  const effectiveRole: Role | "" = role !== "" ? role : (roles.length > 0 ? roles[roles.length - 1] : "")

  const counts = useMemo(() => ({
    invited: chips.filter((c) => c.status === "invited").length,
    skipped: chips.filter((c) => c.status === "exists").length,
    failed: chips.filter((c) => c.status === "failed").length,
  }), [chips])

  const hasFailed = counts.failed > 0
  const canSubmit = chips.length > 0 && effectiveRole !== "" && !busy

  async function send(targets: EmailChip[]) {
    if (targets.length === 0 || effectiveRole === "") return
    setBusy(true); setError(false)
    const emails = targets.map((c) => c.email)
    try {
      const results = await apiPost<InviteResult[]>("/api/users/invite", { Emails: emails, Role: effectiveRole })
      const byEmail = new Map<string, InviteResult>()
      for (const r of results ?? []) byEmail.set(r.Email.toLowerCase(), r)
      setChips((prev) => prev.map((c) => {
        if (!emails.includes(c.email)) return c
        const r = byEmail.get(c.email)
        if (!r || !r.Error) return { ...c, status: "invited" as const, error: undefined }
        if (r.Error === "User already exists") return { ...c, status: "exists" as const, error: undefined }
        return { ...c, status: "failed" as const, error: r.Error }
      }))
      setSubmitted(true)
      // Drop the freshly-invited chips after a beat so the list stays focused on
      // what still needs attention (skipped/failed).
      setTimeout(() => {
        setChips((prev) => prev.filter((c) => c.status !== "invited"))
      }, 1500)
    } catch {
      setError(true)
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

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setChips([]); setRole(""); setBusy(false); setError(false); setSubmitted(false)
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
            <p className="text-xs text-muted-foreground">{summary(t("admin.users.invite.summary"), counts)}</p>
          )}

          <EmailTagInput chips={chips} onChange={setChips} disabled={busy} />

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
              {t("admin.users.invite.roleLabel")}
            </label>
            <Select value={effectiveRole} disabled={busy} onChange={(e) => setRole(e.target.value as Role)}>
              {roles.map((r) => (
                <option key={r} value={r}>{t(`admin.role.${r}`)}</option>
              ))}
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{t("admin.users.invite.error")}</AlertDescription>
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
