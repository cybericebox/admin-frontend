"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ExternalLink, Info, Power } from "lucide-react"
import { bulkTerminateTestLabs, listTestLabsIndex, type TestLab } from "@/api/infrastructure"
import { ImageWarningIcon, LabQueueIndicator } from "@/components/infrastructure/LabIndicators"
import { ResourceCell } from "@/components/infrastructure/ResourceCell"
import { TestLabStatusBadge, testLabAuthor } from "@/components/infrastructure/labView"
import { IndexTable, TimeText } from "@/components/table/IndexTable"
import { useIndexList, type ColumnDef } from "@/components/table/useIndexList"
import type { FilterDef } from "@/components/table/filters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "@/components/ui/toast"
import { overloadOr } from "@/i18n/apiError"
import { tPlural } from "@/i18n/plural"
import { t } from "@/i18n/t"
import { formatListDateTime } from "@/lib/locale"
import { exercisesOrigin } from "@/lib/origins"
import { usePolling } from "@/lib/usePolling"

const IDENTITY = "author"
const BULK_LIMIT = 100
const STATUSES = ["queued", "creating", "ready", "failed"]

/** The «Тестові лабораторії» tab: catalog test labs on the table standard, with «Завершити» one by one and in bulk. */
export function TestLabsTab({ canWrite, onDetails }: { canWrite: boolean; onDetails: (lab: TestLab) => void }) {
  const columns = useMemo<ColumnDef<TestLab>[]>(() => [
    { key: IDENTITY, label: t("admin.labs.testLabs.col.author"), sort: "author", width: 240, cell: (lab) => <Link href={`/users/detail?id=${encodeURIComponent(lab.AuthorID)}`} className="ib-table__name block min-w-0 truncate text-primary hover:underline">{testLabAuthor(lab)}</Link> },
    { key: "exercise", label: t("admin.labs.testLabs.col.exercise"), sort: "exercise", width: 240, cell: (lab) => <a href={`${exercisesOrigin}/detail?id=${encodeURIComponent(lab.ExerciseID)}`} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 hover:text-primary hover:underline"><span className="ib-table__name truncate">{lab.ExerciseName}</span><ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></a> },
    { key: "variant", label: t("admin.labs.testLabs.col.variant"), sort: "variant", dim: true, width: 120, cell: (lab) => lab.VariantNumber > 0 ? t("admin.labs.testLabs.variant", { number: lab.VariantNumber }) : t("admin.labs.testLabs.noVariant") },
    { key: "cpu", label: t("admin.labs.resources.cpu"), sort: "resources", firstDesc: true, width: 150, cell: (lab) => <ResourceCell resources={lab.Resources} kind="cpu" /> },
    { key: "memory", label: t("admin.labs.resources.memory"), sort: "resources", firstDesc: true, width: 150, cell: (lab) => <ResourceCell resources={lab.Resources} kind="memory" /> },
    { key: "created", label: t("admin.labs.testLabs.col.created"), sort: "created", firstDesc: true, dim: true, width: 170, cell: (lab) => <TimeText iso={lab.CreatedAt}>{formatListDateTime(lab.CreatedAt)}</TimeText> },
    { key: "until", label: t("admin.labs.testLabs.col.until"), sort: "until", dim: true, width: 170, cell: (lab) => <TimeText iso={lab.ExpiresAt}>{formatListDateTime(lab.ExpiresAt)}</TimeText> },
    { key: "status", label: t("admin.labs.testLabs.col.status"), sort: "status", width: 200, cell: (lab) => <span className="inline-flex flex-wrap items-center gap-1.5"><TestLabStatusBadge status={lab.Status} /><LabQueueIndicator queue={lab.Queue} />{lab.ImageWarning && <ImageWarningIcon />}{lab.Expired && <Badge size="sm">{t("admin.labs.testLabs.expired")}</Badge>}</span> },
  ], [])
  const defs = useMemo<FilterDef[]>(() => [
    { key: "status", label: t("admin.labs.testLabs.col.status"), type: "choice", single: true, ops: ["in"], options: STATUSES.map((value) => ({ value, label: t(`admin.labs.testLabs.status.${value}`) })) },
  ], [])
  const list = useIndexList<TestLab>({
    table: "admin.labs.testLabs", columns, identity: IDENTITY, defs, defaultSort: { key: "created", dir: "desc" },
    fetch: listTestLabsIndex, rowId: (lab) => lab.ID, selectLimit: BULK_LIMIT,
  })
  usePolling(async () => { list.reload() }, true)

  const [target, setTarget] = useState<TestLab | null>(null)
  const [bulk, setBulk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const ids = target ? [target.ID] : [...list.selected]
      const results = await bulkTerminateTestLabs(ids)
      const done = results.filter((r) => r.Ok).length
      if (done < ids.length) toast.error(t("admin.labs.testLabs.bulk.partial", { done, skipped: ids.length - done }))
      else toast.success(target ? t("admin.labs.testLabs.terminated") : tPlural("admin.labs.testLabs.bulk.done", done))
      setTarget(null); setBulk(false); list.setSelected(new Set()); list.reload()
    } catch (err) { setError(overloadOr(err, t("admin.labs.testLabs.bulk.error"))) } finally { setBusy(false) }
  }

  return <div className="ib-index">
    <IndexTable<TestLab>
      list={list} columns={columns} identity={IDENTITY} title={t("admin.labs.testLabs.title")} rowId={(lab) => lab.ID} rowLabel={(lab) => `${lab.ExerciseName} · ${testLabAuthor(lab)}`}
      defs={defs} searchLabel={t("admin.labs.testLabs.search")} emptyLabel={t("admin.labs.testLabs.emptyFiltered")} emptyInitialLabel={t("admin.labs.testLabs.empty")} errorLabel={t("admin.labs.error.testLabs")}
      actionsLabel={t("admin.labs.testLabs.col.actions")} actionsWidth={canWrite ? 220 : 64}
      bulk={canWrite ? <Button type="button" variant="outline" size="sm" onClick={() => { setError(null); setBulk(true) }}><Power aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />{t("admin.labs.testLabs.terminate")}</Button> : undefined}
      rowActions={(lab) => <span className="flex items-center justify-end gap-1">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("admin.labs.actionOnPair", { action: t("admin.labs.detail.open"), name: lab.ExerciseName, who: testLabAuthor(lab) })} onClick={() => onDetails(lab)}><Info aria-hidden="true" className="h-4 w-4" /></Button>
        {canWrite && <Button type="button" variant="outline" size="sm" className="min-w-max" onClick={() => { setError(null); setTarget(lab) }}><Power aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />{t("admin.labs.testLabs.terminate")}</Button>}
      </span>}
    />
    <ConfirmDialog open={target !== null || bulk} onCancel={() => { if (!busy) { setTarget(null); setBulk(false) } }} tone="danger" busy={busy} busyLabel={t("busy.finishing")} error={error}
      title={target ? t("admin.labs.testLabs.terminate.title") : tPlural("admin.labs.testLabs.bulk.title", list.selected.size)}
      description={target ? t("admin.labs.testLabs.terminate.body", { exercise: target.ExerciseName, author: testLabAuthor(target) }) : t("admin.labs.testLabs.bulk.body")}
      confirmLabel={t("admin.labs.testLabs.terminate.confirm")} onConfirm={() => void run()} />
  </div>
}
