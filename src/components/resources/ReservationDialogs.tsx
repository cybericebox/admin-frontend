"use client"

import { useState } from "react"
import { ApiError } from "@/api/client"
import { deleteEventReservation, replanReservation, type Reservation } from "@/api/resourceCalendar"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "@/components/ui/toast"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { isDoesNotFit, SHRINK_NOTICE_MINUTES } from "@/lib/resourceCalendar"
import { AllowConflictsDialog } from "./resourceView"

/** Cancelling a reservation frees its room and cannot be undone: a danger confirm. */
export function CancelReservationDialog({ target, onCancel, onDone }: { target: { eventID: string; name: string } | null; onCancel: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function confirm() {
    if (!target) return
    setBusy(true)
    setError("")
    try {
      await deleteEventReservation(target.eventID)
      toast.success(t("admin.resources.cancel.done"))
      onDone()
    } catch (err) {
      setError(localizedError(err))
    } finally {
      setBusy(false)
    }
  }
  return <ConfirmDialog open={target !== null} onCancel={onCancel} onConfirm={() => void confirm()} tone="danger" busy={busy} busyLabel={t("busy.cancelling")} error={error}
    title={t("admin.resources.cancel.title", { name: target?.name ?? "" })} description={t("admin.resources.cancel.description")} confirmLabel={t("admin.resources.cancel.confirm")} />
}

/** Replan: re-places every team that still fits. On 72504 it asks before keeping the conflicts. */
export function ReplanDialog({ target, onCancel, onDone }: { target: Reservation | null; onCancel: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [confirmConflicts, setConfirmConflicts] = useState(false)

  async function run(allowConflicts: boolean) {
    if (!target) return
    setBusy(true)
    setError("")
    try {
      await replanReservation(target.ID, allowConflicts)
      toast.success(t("admin.resources.replan.done"))
      setConfirmConflicts(false)
      onDone()
    } catch (err) {
      if (!allowConflicts && isDoesNotFit(err)) setConfirmConflicts(true)
      else setError(err instanceof ApiError ? localizedError(err) : t("error.generic"))
    } finally {
      setBusy(false)
    }
  }
  return <>
    <ConfirmDialog open={target !== null && !confirmConflicts} onCancel={onCancel} onConfirm={() => void run(false)} busy={busy} busyLabel={t("busy.replanning")} error={error}
      title={t("admin.resources.replan.title", { name: target?.EventName ?? "" })} description={t("admin.resources.replan.description")} confirmLabel={t("admin.resources.replan.confirm")} />
    <AllowConflictsDialog open={target !== null && confirmConflicts} busy={busy} error={error} onCancel={() => { setConfirmConflicts(false); onCancel() }} onConfirm={() => void run(true)} />
  </>
}

/**
 * The new size or end leaves out labs that already run: the cluster deletes them after its notice. A danger confirm;
 * without it the cluster keeps the reservation as large as what runs in it.
 */
export function ShrinkDialog({ open, busy, error, onCancel, onConfirm }: { open: boolean; busy: boolean; error?: string; onCancel: () => void; onConfirm: () => void }) {
  return <ConfirmDialog open={open} onCancel={onCancel} onConfirm={onConfirm} tone="danger" busy={busy} busyLabel={t("busy.saving")} error={error}
    title={t("admin.resources.shrink.title")} description={t("admin.resources.shrink.body", { minutes: SHRINK_NOTICE_MINUTES })} confirmLabel={t("admin.resources.shrink.confirm")} />
}
