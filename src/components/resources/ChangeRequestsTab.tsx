"use client"

import { useMemo, useState } from "react"
import { decideChangeRequest, listChangeRequests, type ChangeRequest, type ChangeStatus } from "@/api/resourceCalendar"
import { ApiError } from "@/api/client"
import { Button } from "@/components/ui/button"
import { TableState, TableWrap, TimeText } from "@/components/common/DsTable"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { SelectMenu } from "@/components/ui/select-menu"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { localizedError } from "@/i18n/apiError"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { CODE_ALREADY_DECIDED, isAmountEmpty, isDoesNotFit } from "@/lib/resourceCalendar"
import { AllowConflictsDialog, Badge, Th, formatAmount, formatWindow, useCalendarResource, type Tone } from "./resourceView"

const STATUSES: ("all" | ChangeStatus)[] = ["all", "pending", "approved", "rejected"]
const STATUS_TONE: Record<ChangeStatus, Tone> = { pending: "warn", approved: "ok", rejected: "muted" }

/** What the request asks for, one line per changed part, against what the reservation has now. */
function Asked({ request }: { request: ChangeRequest }) {
  const lines: string[] = []
  if (request.Size && !isAmountEmpty(request.Size)) lines.push(t("admin.resources.requests.askSize", { amount: formatAmount(request.Size), current: formatAmount(request.CurrentSize) }))
  if (request.Dynamic && !isAmountEmpty(request.Dynamic)) lines.push(t("admin.resources.requests.askDynamic", { amount: formatAmount(request.Dynamic) }))
  if (request.WindowStart || request.WindowEnd) lines.push(t("admin.resources.requests.askWindow", { window: formatWindow(request.WindowStart ?? request.CurrentFrom, request.WindowEnd ?? request.CurrentTo), current: formatWindow(request.CurrentFrom, request.CurrentTo) }))
  return <ul className="space-y-0.5">{lines.map((line) => <li key={line}>{line}</li>)}</ul>
}

type Decision = { request: ChangeRequest; approve: boolean }

export function ChangeRequestsTab({ canWrite, version, onDecided }: { canWrite: boolean; version: number; onDecided: () => void }) {
  const [status, setStatus] = useState<"all" | ChangeStatus>("pending")
  const [query, setQuery] = useState("")
  const { data, error, refresh } = useCalendarResource(() => listChangeRequests(status === "all" ? {} : { status }), true, `${status}|${version}`)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState("")
  const [needsConflicts, setNeedsConflicts] = useState(false)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data ?? []).filter((request) => !needle || `${request.EventName} ${request.EventTag}`.toLowerCase().includes(needle))
  }, [data, query])

  const open = (next: Decision) => { setNote(""); setDialogError(""); setNeedsConflicts(false); setDecision(next) }
  const close = () => { if (!busy) { setDecision(null); setNeedsConflicts(false) } }

  async function decide(allowConflicts: boolean) {
    if (!decision) return
    setBusy(true)
    setDialogError("")
    try {
      await decideChangeRequest(decision.request.ID, { Approve: decision.approve, Note: note.trim(), ...(allowConflicts ? { AllowConflicts: true } : {}) })
      toast.success(t(decision.approve ? "admin.resources.requests.approved" : "admin.resources.requests.rejected"))
      setDecision(null)
      setNeedsConflicts(false)
      await refresh(true)
      onDecided()
    } catch (err) {
      if (isDoesNotFit(err) && !allowConflicts) setNeedsConflicts(true)
      else if (err instanceof ApiError && err.code === CODE_ALREADY_DECIDED) {
        toast.error(localizedError(err))
        setDecision(null)
        setNeedsConflicts(false)
        void refresh(true)
      } else setDialogError(localizedError(err))
    } finally {
      setBusy(false)
    }
  }

  const name = decision ? decision.request.EventName || decision.request.EventTag : ""
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <SelectMenu value={status} onChange={(value) => setStatus(value as "all" | ChangeStatus)} ariaLabel={t("admin.resources.requests.filterStatus")} className="min-w-44 text-sm"
        options={STATUSES.map((value) => ({ value, label: t(`admin.resources.requests.status.${value}`) }))} />
      <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("admin.resources.requests.search")} aria-label={t("admin.resources.requests.search")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-sm" />
    </div>
    <TableWrap label={t("admin.resources.tabs.requests")} rows={6}>
      <table aria-label={t("admin.resources.tabs.requests")} className="ib-table">
        <thead><tr><Th>{t("admin.resources.col.event")}</Th><Th>{t("admin.resources.requests.asked")}</Th><Th>{t("admin.resources.requests.reason")}</Th><Th>{t("admin.resources.col.state")}</Th><Th className="w-44"><span className="sr-only">{t("admin.resources.col.actions")}</span></Th></tr></thead>
        {error && data === null ? <TableState colSpan={5} kind="error" message={t("admin.resources.requests.loadError")} error={error} onRetry={() => void refresh(true)} />
          : data === null ? <TableState colSpan={5} kind="loading" />
          : rows.length === 0 ? <TableState colSpan={5} kind="empty" message={t(query || status !== "all" ? "admin.resources.requests.emptyFiltered" : "admin.resources.requests.empty")} />
          : <tbody>{rows.map((request) => <tr key={request.ID} data-testid={`request-${request.ID}`}>
            <td><span className="block font-medium leading-tight">{request.EventName || request.EventTag}</span><span className="text-xs text-muted-foreground"><TimeText iso={request.RequestedAt}>{formatDateTime(request.RequestedAt, { dateStyle: "short", timeStyle: "short" })}</TimeText></span></td>
            <td className="!whitespace-normal py-1"><Asked request={request} /></td>
            <td className="ib-table__dim max-w-xs !whitespace-normal break-words">{request.Reason}</td>
            <td className="!whitespace-normal py-1"><span className="block"><Badge tone={STATUS_TONE[request.Status]}>{t(`admin.resources.requests.status.${request.Status}`)}</Badge></span>{request.DecisionNote && <span className="mt-1 block text-xs text-muted-foreground">{request.DecisionNote}</span>}</td>
            <td className="ib-table__actions">{canWrite && request.Status === "pending" && <span className="inline-flex gap-2">
              <Button type="button" size="sm" onClick={() => open({ request, approve: true })}>{t("admin.resources.requests.approve")}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => open({ request, approve: false })}>{t("admin.resources.requests.reject")}</Button>
            </span>}</td>
          </tr>)}</tbody>}
      </table>
    </TableWrap>
    <ConfirmDialog open={decision !== null && !needsConflicts} onCancel={close} onConfirm={() => void decide(false)} busy={busy} error={dialogError}
      tone={decision?.approve ? "default" : "danger"}
      title={t(decision?.approve ? "admin.resources.requests.approveTitle" : "admin.resources.requests.rejectTitle", { name })}
      description={t(decision?.approve ? "admin.resources.requests.approveDescription" : "admin.resources.requests.rejectDescription")}
      confirmLabel={t(decision?.approve ? "admin.resources.requests.approve" : "admin.resources.requests.reject")}>
      <label className="block space-y-1.5 text-sm font-medium">{t("admin.resources.requests.note")}
        <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} /></label>
    </ConfirmDialog>
    <AllowConflictsDialog open={decision !== null && needsConflicts} busy={busy} error={dialogError} onCancel={() => { setNeedsConflicts(false); setDecision(null) }} onConfirm={() => void decide(true)} />
  </div>
}
