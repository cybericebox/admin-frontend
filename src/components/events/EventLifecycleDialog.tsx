"use client"

import { useState, type FormEvent } from "react"
import { apiPut } from "@/api/client"
import { eventErrorMessage } from "@/lib/eventErrors"
import { isoToLocal, localToIso } from "@/lib/eventSchemas"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { SelectMenu } from "@/components/ui/select-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { t } from "@/i18n/t"

export type EventLifecycle = {
  Status: "not_published" | "published" | "started" | "finished" | "withdrawn" | "unknown"
  JoinPolicy: number
  PublishAt: string
  StartAt: string
  FinishAt: string | null
  WithdrawAt: string | null
  UpdatedAt: string
  Infrastructure: {
    HasDynamicLabs: boolean
    RequiresVPN: boolean
    CanStart: boolean
    Reason: string | null
  }
}

const joinOptions = [
  { value: "0", label: t("admin.events.schedule.join.beforeStart") },
  { value: "1", label: t("admin.events.schedule.join.afterStart") },
]

export function EventLifecycleDialog({ eventID, lifecycle, onClose, onSaved }: {
  eventID: string
  lifecycle: EventLifecycle
  onClose: () => void
  onSaved: (next: EventLifecycle) => void
}) {
  const [joinPolicy, setJoinPolicy] = useState(lifecycle.JoinPolicy)
  const [publishAt, setPublishAt] = useState(() => isoToLocal(lifecycle.PublishAt))
  const [startAt, setStartAt] = useState(() => isoToLocal(lifecycle.StartAt))
  const [finishAt, setFinishAt] = useState(() => isoToLocal(lifecycle.FinishAt ?? ""))
  const [withdrawAt, setWithdrawAt] = useState(() => isoToLocal(lifecycle.WithdrawAt ?? ""))
  const [scheduled, setScheduled] = useState(lifecycle.FinishAt !== null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const isDirty = joinPolicy !== lifecycle.JoinPolicy || publishAt !== isoToLocal(lifecycle.PublishAt) || startAt !== isoToLocal(lifecycle.StartAt) ||
    scheduled !== (lifecycle.FinishAt !== null) || finishAt !== isoToLocal(lifecycle.FinishAt ?? "") || withdrawAt !== isoToLocal(lifecycle.WithdrawAt ?? "")

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !isDirty) return
    setError("")
    const publish = new Date(publishAt).getTime()
    const start = new Date(startAt).getTime()
    const finish = scheduled ? new Date(finishAt).getTime() : null
    const withdraw = scheduled ? new Date(withdrawAt).getTime() : null
    if (!Number.isFinite(publish) || !Number.isFinite(start) || start < publish ||
      (scheduled && (!Number.isFinite(finish) || !Number.isFinite(withdraw) || finish! <= start || withdraw! <= finish!))) {
      setError(t("admin.events.schedule.val.order"))
      return
    }
    setBusy(true)
    try {
      const next = await apiPut<EventLifecycle>(`/api/events/${encodeURIComponent(eventID)}/manage/lifecycle`, {
        JoinPolicy: joinPolicy,
        PublishAt: localToIso(publishAt),
        StartAt: localToIso(startAt),
        FinishAt: scheduled ? localToIso(finishAt) : null,
        WithdrawAt: scheduled ? localToIso(withdrawAt) : null,
      })
      onSaved(next)
      toast.success(t("admin.events.schedule.saved"))
      onClose()
    } catch (failure) {
      toast.error(eventErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{t("admin.events.schedule.title")}</DialogTitle><DialogDescription>{t("admin.events.schedule.description")}</DialogDescription></DialogHeader>
      <form onSubmit={(event) => void save(event)} className="space-y-4">
        <div className="space-y-1.5"><label className="text-sm font-medium">{t("admin.events.schedule.field.joinPolicy")}</label><SelectMenu value={joinPolicy.toString()} onChange={(value) => setJoinPolicy(Number(value))} options={joinOptions} ariaLabel={t("admin.events.schedule.field.joinPolicy")} disabled={busy} className="w-full" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><label className="text-sm font-medium">{t("admin.events.schedule.field.publishAt")}</label><DateTimePicker value={publishAt} onChange={setPublishAt} aria-label={t("admin.events.schedule.field.publishAt")} disabled={busy} /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">{t("admin.events.schedule.field.startAt")}</label><DateTimePicker value={startAt} onChange={setStartAt} aria-label={t("admin.events.schedule.field.startAt")} disabled={busy} /></div>
        </div>
        <div className="flex items-center gap-2"><Switch id="event-lifecycle-no-finish" checked={!scheduled} onCheckedChange={(noFinish) => { setScheduled(!noFinish); if (noFinish) { setFinishAt(""); setWithdrawAt("") } }} disabled={busy} /><label htmlFor="event-lifecycle-no-finish" className="text-sm leading-snug cursor-pointer select-none">{t("admin.events.schedule.noFinish")}</label></div>
        {scheduled && <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><label className="text-sm font-medium">{t("admin.events.schedule.field.finishAt")}</label><DateTimePicker value={finishAt} onChange={setFinishAt} aria-label={t("admin.events.schedule.field.finishAt")} disabled={busy} /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">{t("admin.events.schedule.field.withdrawAt")}</label><DateTimePicker value={withdrawAt} onChange={setWithdrawAt} aria-label={t("admin.events.schedule.field.withdrawAt")} disabled={busy} /></div>
        </div>}
        {!lifecycle.Infrastructure.CanStart && lifecycle.Infrastructure.HasDynamicLabs && <p className="text-sm text-muted-foreground">{t("admin.events.schedule.cannotStart")}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("admin.events.dialog.cancel")}</Button><Button type="submit" busy={busy} disabled={!isDirty}>{t("admin.events.schedule.submit")}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
