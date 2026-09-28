"use client"

import { useState, type FormEvent } from "react"
import { apiPut } from "@/api/client"
import { eventErrorMessage } from "@/lib/eventErrors"
import { isoToLocal, localToIso } from "@/lib/eventSchemas"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { SelectMenu } from "@/components/ui/select-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"

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
  { value: "0", label: "Приєднання до старту" },
  { value: "1", label: "Приєднання після старту дозволено" },
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
      setError("Перевірте порядок дат: публікація, старт, фініш і зняття з публікації.")
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
      toast.success("Розклад заходу збережено.")
      onClose()
    } catch (failure) {
      toast.error(eventErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Життєвий цикл заходу</DialogTitle><DialogDescription>Стан визначається датами автоматично. Після старту доступ до завдань залежить також від готовності лабораторій.</DialogDescription></DialogHeader>
      <form onSubmit={(event) => void save(event)} className="space-y-4">
        <div className="space-y-1.5"><label className="text-sm font-medium">Політика приєднання</label><SelectMenu value={joinPolicy.toString()} onChange={(value) => setJoinPolicy(Number(value))} options={joinOptions} ariaLabel="Політика приєднання" disabled={busy} className="w-full" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><label className="text-sm font-medium">Публікація</label><DateTimePicker value={publishAt} onChange={setPublishAt} aria-label="Публікація" disabled={busy} /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Старт</label><DateTimePicker value={startAt} onChange={setStartAt} aria-label="Старт" disabled={busy} /></div>
        </div>
        <Checkbox checked={!scheduled} onChange={(event) => { setScheduled(!event.target.checked); if (event.target.checked) { setFinishAt(""); setWithdrawAt("") } }} disabled={busy} label="Без запланованого завершення" />
        {scheduled && <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><label className="text-sm font-medium">Фініш</label><DateTimePicker value={finishAt} onChange={setFinishAt} aria-label="Фініш" disabled={busy} /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Зняття з публікації</label><DateTimePicker value={withdrawAt} onChange={setWithdrawAt} aria-label="Зняття з публікації" disabled={busy} /></div>
        </div>}
        {!lifecycle.Infrastructure.CanStart && lifecycle.Infrastructure.HasDynamicLabs && <p className="text-sm text-muted-foreground">Поточна лабораторна інфраструктура не дозволяє запустити захід зараз. Майбутній розклад можна зберегти.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Скасувати</Button><Button type="submit" disabled={busy || !isDirty}>Зберегти розклад</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
