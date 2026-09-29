"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { listEmailTemplates } from "@/api/notifications/emailTemplates"
import { listInAppTemplates } from "@/api/notifications/inAppTemplates"
import { t } from "@/i18n/t"
import { statusLabelKey } from "@/lib/templateStatus"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StatusPill } from "@/components/notifications/StatusPill"
import { LoadingArea } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"

type Version = {
  ID: string
  Status: "draft" | "published" | "unpublished"
  UpdatedAt: string
  PublishedAt: string | null
  Title?: string
  Subject?: string
}

type Props = {
  channel: "in-app" | "email"
  notificationType: string
  currentId: string
  canWrite: boolean
  dirty: boolean
  busy: boolean
  refreshKey: number
  onRestore: (sourceId: string) => Promise<boolean>
}

export function TemplateVersions({ channel, notificationType, currentId, canWrite, dirty, busy, refreshKey, onRestore }: Props) {
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [restoreSource, setRestoreSource] = useState<Version | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState(false)

  useEffect(() => {
    if (!open || !notificationType) return
    let active = true
    const request = channel === "email"
      ? listEmailTemplates({ type: notificationType })
      : listInAppTemplates({ type: notificationType })
    request.then((result) => {
      if (!active) return
      setVersions(result.Templates
        .filter((version) => version.NotificationType === notificationType)
        .sort((a, b) => Date.parse(b.PublishedAt ?? b.UpdatedAt) - Date.parse(a.PublishedAt ?? a.UpdatedAt)))
      setLoadError(false)
    }).catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [channel, notificationType, open, refreshKey])

  async function restore() {
    if (!restoreSource || restoring || busy) return
    setRestoring(true)
    setRestoreError(false)
    try {
      if (await onRestore(restoreSource.ID)) {
        setRestoreSource(null)
        setOpen(false)
      } else {
        setRestoreError(true)
      }
    } finally {
      setRestoring(false)
    }
  }

  return <>
    <section className="mb-6 rounded-lg border border-border bg-card">
      <button type="button" aria-expanded={open} onClick={() => {
        if (!open) { setVersions(null); setLoadError(false) }
        setOpen(!open)
      }} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-accent/50">
        {t("admin.notif.versions.title")}
        <ChevronDown aria-hidden="true" className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border px-4 py-2">
        {loadError && <p className="py-2 text-sm text-destructive">{t("admin.notif.versions.loadError")}</p>}
        {!loadError && versions === null && <LoadingArea compact label={t("admin.loading")} />}
        {!loadError && versions?.length === 0 && <EmptyState message={t("admin.notif.versions.empty")} compact />}
        {!loadError && versions?.map((version) => <div key={version.ID} className="flex flex-wrap items-center gap-3 border-b border-border py-2.5 last:border-b-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={version.Status} label={t(statusLabelKey(version.Status))} />
              <span className="text-xs text-muted-foreground">{new Date(version.PublishedAt ?? version.UpdatedAt).toLocaleString("uk-UA")}</span>
            </div>
            <p className="mt-1 truncate text-sm text-foreground">{channel === "email" ? version.Subject : version.Title}</p>
          </div>
          {version.ID === currentId
            ? <span className="text-xs font-medium text-muted-foreground">{t("admin.notif.versions.current")}</span>
            : <Link href={`/notifications/templates/${channel}/detail?id=${version.ID}`} className="text-xs font-medium text-primary hover:underline">{t("admin.notif.versions.open")}</Link>}
          {canWrite && version.Status !== "draft" && <Button type="button" size="sm" variant="outline" disabled={busy || restoring}
            onClick={() => { setRestoreError(false); setRestoreSource(version) }}>
            {t("admin.notif.tpl.rollback")}
          </Button>}
        </div>)}
      </div>}
    </section>

    <Dialog open={restoreSource !== null} onOpenChange={(next) => { if (!next && !restoring) setRestoreSource(null) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.notif.versions.restoreTitle")}</DialogTitle>
          <DialogDescription>{t(versions?.some((version) => version.Status === "draft")
            ? "admin.notif.versions.restoreDescription"
            : "admin.notif.versions.restoreDescriptionNoDraft")}</DialogDescription>
        </DialogHeader>
        {dirty && <p className="text-sm text-destructive">{t("admin.notif.versions.unsavedWarning")}</p>}
        {restoreError && <p className="text-sm text-destructive">{t("admin.notif.versions.restoreError")}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={restoring} onClick={() => setRestoreSource(null)}>{t("admin.notif.tpl.cancel")}</Button>
          <Button type="button" disabled={restoring || busy} onClick={() => void restore()}>{t("admin.notif.tpl.rollback")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
