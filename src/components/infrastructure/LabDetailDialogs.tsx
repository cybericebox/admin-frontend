"use client"

import { useCallback, useState, type ReactNode } from "react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { ImageWarningIcon, QueueBadge } from "@/components/infrastructure/LabIndicators"
import { LabLiveView } from "@/components/infrastructure/LabLiveView"
import { GroupLifecycleFacts, LifecycleFacts } from "@/components/infrastructure/LifecycleFacts"
import { useLabDetail } from "@/components/infrastructure/useLabDetail"
import { StandStatusBadge, teamLabel } from "@/components/infrastructure/StandsTable"
import { TestLabStatusBadge, testLabAuthor } from "@/components/infrastructure/TestLabsTable"
import {
  getStandDetail, getTestLabDetail, rescueStandDevice, rescueTestLabDevice, resetStandDevice, resetTestLabDevice,
  type LabDevice, type LabLive, type Stand, type StandDetail, type TestLab, type TestLabDetail,
} from "@/api/infrastructure"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"

const BLOCK = "flex min-h-64 items-center justify-center"

function withRescue(live: LabLive | null, device: string, enable: boolean): LabLive | null {
  if (!live) return live
  return { ...live, Devices: live.Devices.map((item: LabDevice) => item.Name === device && item.Snapshot ? { ...item, Snapshot: { ...item.Snapshot, Rescue: enable } } : item) }
}

function Shell({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description: string; children: ReactNode }) {
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
    <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-4 overflow-hidden">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <div className="min-h-64 flex-1 overflow-y-auto pr-1">{children}</div>
    </DialogContent>
  </Dialog>
}

function Body<T>({ data, error, onRetry, children }: { data: T | null; error: unknown; onRetry: () => void; children: (data: T) => ReactNode }) {
  if (data) return <>{error ? <LoadError message={t("admin.labs.detail.error")} error={error} compact onRetry={onRetry} /> : null}{children(data)}</>
  if (error) return <LoadError message={t("admin.labs.detail.error")} error={error} onRetry={onRetry} className={BLOCK} />
  return <LoadingArea className={BLOCK} label={t("admin.loading")} />
}

type ResetTarget = { device: string; challengeId?: string; run: () => Promise<unknown> }

function ResetDialog({ target, onClose, onDone }: { target: ResetTarget | null; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run() {
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      await target.run()
      toast.success(t("admin.labs.detail.reset.done"))
      onClose()
      onDone()
    } catch (cause) {
      setError(localizedError(cause))
    } finally {
      setBusy(false)
    }
  }
  return <ConfirmDialog open={target !== null} onCancel={() => { if (!busy) { setError(null); onClose() } }} tone="danger" busy={busy} error={error}
    title={t("admin.labs.detail.reset.title")}
    description={target ? t("admin.labs.detail.reset.body", { device: target.device }) : undefined}
    confirmLabel={t("admin.labs.detail.reset.confirm")}
    onConfirm={() => void run()} />
}

export function StandDetailDialog({ stand, canWrite, onClose }: { stand: Stand | null; canWrite: boolean; onClose: () => void }) {
  return stand && <StandDetail key={`${stand.EventID}:${stand.TeamID}`} stand={stand} canWrite={canWrite} onClose={onClose} />
}

function StandDetail({ stand, canWrite, onClose }: { stand: Stand; canWrite: boolean; onClose: () => void }) {
  const load = useCallback(() => getStandDetail(stand.EventID, stand.TeamID), [stand.EventID, stand.TeamID])
  const { data, error, refresh, enqueue } = useLabDetail<StandDetail>(load, true)
  const [reset, setReset] = useState<ResetTarget | null>(null)
  // Polling closure (or removal) withdraws an existing confirmation as well as device controls.
  const activeReset = reset && canWrite && data?.Labs.some((row) => row.ChallengeID === reset.challengeId && row.Lab?.ClosedAt == null) ? reset : null

  const rescue = (challengeId: string, device: string, enable: boolean) => {
    enqueue((value) => ({ ...value, Labs: value.Labs.map((lab) => lab.ChallengeID === challengeId ? { ...lab, Live: withRescue(lab.Live, device, enable) } : lab) }),
      () => rescueStandDevice(stand.EventID, stand.TeamID, challengeId, device, enable))
  }

  return <Shell open onClose={onClose}
    title={t("admin.labs.detail.stand.title", { team: teamLabel(stand) })}
    description={t("admin.labs.detail.stand.subtitle", { event: stand.EventName || stand.EventTag })}>
    <Body data={data} error={error} onRetry={refresh}>{(detail) => <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StandStatusBadge status={detail.Status} />
        {stand.Queue && <QueueBadge position={stand.Queue.Position} length={stand.Queue.Length} reason={stand.Queue.Reason} labs={stand.Queue.QueuedLabs} />}
        {stand.ImageWarning && <ImageWarningIcon />}
        {detail.Reason && <span className="break-words text-sm text-muted-foreground">{detail.Reason}</span>}
      </div>
      {detail.Group && <GroupLifecycleFacts group={detail.Group} />}
      {!detail.LaboratoriesAvailable ? <EmptyState compact message={t("admin.labs.detail.unavailable")} />
        : detail.Labs.length === 0 ? <EmptyState compact message={t("admin.labs.detail.stand.empty")} />
        : <ul className="space-y-4">{detail.Labs.map((lab) => <li key={lab.Lab?.ID ?? lab.ChallengeID} className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words font-medium text-foreground">{lab.Lab?.ExerciseName ?? lab.ChallengeName}</h3>
            <StandStatusBadge status={lab.Status} />
            {lab.Reason && <span className="break-words text-sm text-muted-foreground">{lab.Reason}</span>}
          </div>
          {lab.Lab && <LifecycleFacts lab={lab.Lab} />}
          {!!lab.Questions?.length && <div className="min-w-0 text-sm">
            <p className="text-xs text-muted-foreground">{t("admin.labs.lifecycle.questions")}</p>
            <ul className="list-inside list-disc">{lab.Questions.map((question) => <li className="break-words" key={question.EventChallengeID}>{question.Name}</li>)}</ul>
          </div>}
          <LabLiveView live={lab.Live} unavailable={lab.LiveUnavailable} canWrite={canWrite && lab.Lab?.ClosedAt == null}
            onReset={(device) => setReset({ device, challengeId: lab.ChallengeID, run: () => resetStandDevice(stand.EventID, stand.TeamID, lab.ChallengeID, device) })}
            onRescue={(device, enable) => rescue(lab.ChallengeID, device, enable)} />
        </li>)}</ul>}
    </div>}</Body>
    <ResetDialog target={activeReset} onClose={() => setReset(null)} onDone={refresh} />
  </Shell>
}

export function TestLabDetailDialog({ lab, canWrite, onClose }: { lab: TestLab | null; canWrite: boolean; onClose: () => void }) {
  return lab && <TestLabDetail key={lab.ID} lab={lab} canWrite={canWrite} onClose={onClose} />
}

function TestLabDetail({ lab, canWrite, onClose }: { lab: TestLab; canWrite: boolean; onClose: () => void }) {
  const load = useCallback(() => getTestLabDetail(lab.ID), [lab.ID])
  const { data, error, refresh, enqueue } = useLabDetail<TestLabDetail>(load, true)
  const [reset, setReset] = useState<ResetTarget | null>(null)

  const rescue = (device: string, enable: boolean) => {
    enqueue((value) => ({ ...value, Live: withRescue(value.Live, device, enable) }), () => rescueTestLabDevice(lab.ID, device, enable))
  }

  return <Shell open onClose={onClose}
    title={t("admin.labs.detail.testLab.title", { exercise: lab.ExerciseName })}
    description={t("admin.labs.detail.testLab.subtitle", { author: testLabAuthor(lab) })}>
    <Body data={data} error={error} onRetry={refresh}>{(detail) => <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TestLabStatusBadge status={detail.Status} />
        {lab.ImageWarning && <ImageWarningIcon />}
      </div>
      <LabLiveView live={detail.Live} canWrite={canWrite}
        onReset={(device) => setReset({ device, run: () => resetTestLabDevice(detail.ID, device) })}
        onRescue={rescue} />
    </div>}</Body>
    <ResetDialog target={reset} onClose={() => setReset(null)} onDone={refresh} />
  </Shell>
}
