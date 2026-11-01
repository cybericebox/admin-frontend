"use client"

import { useEffect, useState } from "react"
import { getEmailTemplate } from "@/api/notifications/emailTemplates"
import { getInAppTemplate } from "@/api/notifications/inAppTemplates"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { t } from "@/i18n/t"
import { emailLines, inAppLines, lineDiff, type DiffLine } from "./templateDiff"

/** The change from a version to the one being edited: what the version has that the current one lacks (removed) and the other way round (added). */
export function VersionDiffDialog({ channel, versionId, currentId, onClose }: { channel: "email" | "in-app"; versionId: string | null; currentId: string; onClose: () => void }) {
  const [state, setState] = useState<{ key: string; lines?: DiffLine[]; error?: unknown } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${versionId}|${currentId}|${attempt}`

  useEffect(() => {
    if (!versionId) return
    let active = true
    const load = channel === "email"
      ? Promise.all([getEmailTemplate(versionId), getEmailTemplate(currentId)]).then(([a, b]) => {
        const label = { subject: t("admin.notif.diff.subject"), preheader: t("admin.notif.diff.preheader"), button: t("admin.notif.diff.button"), image: t("admin.notif.diff.image") }
        return lineDiff(emailLines(a, label), emailLines(b, label))
      })
      : Promise.all([getInAppTemplate(versionId), getInAppTemplate(currentId)]).then(([a, b]) => {
        const label = { title: t("admin.notif.diff.title"), link: t("admin.notif.diff.link") }
        return lineDiff(inAppLines(a, label), inAppLines(b, label))
      })
    load.then((lines) => { if (active) setState({ key, lines }) }).catch((error) => { if (active) setState({ key, error }) })
    return () => { active = false }
  }, [channel, versionId, currentId, key])

  const ready = state?.key === key ? state : null
  const changed = ready?.lines?.some((line) => line.kind !== "same")
  return <Dialog open={versionId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{t("admin.notif.diff.title.dialog")}</DialogTitle></DialogHeader>
      <p className="text-xs text-muted-foreground">{t("admin.notif.diff.legend")}</p>
      <div className="min-h-40 max-h-[60dvh] overflow-auto rounded-md border border-border">
        {!ready ? <LoadingArea compact label={t("admin.loading")} />
          : ready.error ? <LoadError message={t("admin.notif.diff.loadError")} error={ready.error} compact onRetry={() => setAttempt((n) => n + 1)} />
          : !changed ? <EmptyState compact message={t("admin.notif.diff.same")} />
          : <ul className="font-mono text-xs">{ready.lines!.map((line, index) => <li key={index} data-kind={line.kind}
            className={`flex gap-2 whitespace-pre-wrap break-words px-3 py-1 ${line.kind === "removed" ? "bg-[var(--ib-danger-bg)] text-[var(--ib-danger)]" : line.kind === "added" ? "bg-[var(--ib-ok-bg)] text-foreground" : "text-muted-foreground"}`}>
            <span aria-hidden="true" className="w-3 shrink-0">{line.kind === "removed" ? "−" : line.kind === "added" ? "+" : ""}</span>
            <span className="sr-only">{t(line.kind === "same" ? "admin.notif.diff.same.line" : `admin.notif.diff.${line.kind}`)}: </span>{line.text}</li>)}</ul>}
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">{t("admin.notif.logs.close")}</Button></DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>
}
