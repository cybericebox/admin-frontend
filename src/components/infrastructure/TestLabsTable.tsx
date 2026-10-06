"use client"

import Link from "next/link"
import { ExternalLink, Info, Power } from "lucide-react"
import { ImageWarningIcon, QueueBadge } from "@/components/infrastructure/LabIndicators"
import { ResourceCell } from "@/components/infrastructure/ResourceCell"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { TableState, TableWrap, Th, TimeText } from "@/components/common/DsTable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FieldHelp } from "@/components/ui/field-help"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Input } from "@/components/ui/input"
import { TablePagination } from "@/components/ui/table-pagination"
import type { TestLab } from "@/api/infrastructure"
import { exercisesOrigin } from "@/lib/origins"
import { formatListDateTime } from "@/lib/locale"
import { t } from "@/i18n/t"

export type TestLabsFilters = { search: string; page: number; pageSize: number }

const STATUS_TONE: Record<string, BadgeTone> = { queued: "warn", creating: "warn", ready: "ok", failed: "danger", unknown: "neutral" }

export function TestLabStatusBadge({ status }: { status: string }) {
  const known = status in STATUS_TONE
  return <Badge size="sm" tone={STATUS_TONE[known ? status : "unknown"]}>{t(`admin.labs.testLabs.status.${known ? status : "unknown"}`)}</Badge>
}

export function testLabAuthor(lab: TestLab): string {
  return lab.AuthorName || lab.AuthorEmail
}

export function TestLabsTable({ filters, searchInput, onSearchInput, onFilters, items, total, loading, error, errorCause, canWrite, onRetry, onTerminate, onDetails }: {
  filters: TestLabsFilters
  searchInput: string
  onSearchInput: (value: string) => void
  onFilters: (patch: Partial<TestLabsFilters>) => void
  items: TestLab[] | null
  total: number
  loading: boolean
  error: string
  errorCause?: unknown
  canWrite: boolean
  onRetry: () => void
  onTerminate: (lab: TestLab) => void
  onDetails: (lab: TestLab) => void
}) {
  const label = t("admin.labs.testLabs.title")
  return <Card id="test-labs">
    <CardHeader><CardTitle className="flex items-center gap-1.5 text-base">{t("admin.labs.testLabs.title")}<FieldHelp text={t("admin.labs.testLabs.titleHelp")} /></CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input type="search" value={searchInput} onChange={(event) => onSearchInput(event.target.value)} placeholder={t("admin.labs.testLabs.search")} aria-label={t("admin.labs.testLabs.search")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-sm" />
        <FieldHelp text={t("admin.labs.testLabs.searchHelp")} />
      </div>
      <TableWrap label={label} rows={7}>
        <table aria-label={label} aria-busy={loading} className="ib-table">
          <thead>
            <tr>
              <Th>{t("admin.labs.testLabs.col.author")}</Th>
              <Th>{t("admin.labs.testLabs.col.exercise")}</Th>
              <Th>{t("admin.labs.testLabs.col.variant")}</Th>
              <Th>{t("admin.labs.resources.cpu")}</Th>
              <Th>{t("admin.labs.resources.memory")}</Th>
              <Th>{t("admin.labs.testLabs.col.created")}</Th>
              <Th>{t("admin.labs.testLabs.col.until")}</Th>
              <Th>{t("admin.labs.testLabs.col.status")}</Th>
              <Th className="ib-table__actions"><span className="sr-only">{t("admin.labs.testLabs.col.actions")}</span></Th>
            </tr>
          </thead>
          {error ? <TableState colSpan={9} kind="error" message={error} error={errorCause} onRetry={onRetry} />
            : items === null ? <TableState colSpan={9} kind="loading" />
            : items.length === 0 ? <TableState colSpan={9} kind="empty" message={t(filters.search ? "admin.labs.testLabs.emptyFiltered" : "admin.labs.testLabs.empty")} />
            : <tbody>
              {items.map((lab) => <tr key={lab.ID}>
                <td><Link href={`/users/detail?id=${encodeURIComponent(lab.AuthorID)}`} className="ib-table__name block text-primary hover:underline">{testLabAuthor(lab)}</Link>{lab.AuthorName && <span className="block text-xs text-muted-foreground">{lab.AuthorEmail}</span>}</td>
                <td>
                  <HoverTooltip text={t("admin.labs.testLabs.openExercise")}>
                    <a href={`${exercisesOrigin}/detail?id=${encodeURIComponent(lab.ExerciseID)}`} target="_blank" rel="noopener noreferrer" aria-label={`${t("admin.labs.testLabs.openExercise")}: ${lab.ExerciseName}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-md text-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      <span className="ib-table__name">{lab.ExerciseName}</span>
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  </HoverTooltip>
                </td>
                <td className="ib-table__dim">{lab.VariantNumber > 0 ? t("admin.labs.testLabs.variant", { number: lab.VariantNumber }) : t("admin.labs.testLabs.noVariant")}</td>
                <td><ResourceCell resources={lab.Resources} kind="cpu" /></td>
                <td><ResourceCell resources={lab.Resources} kind="memory" /></td>
                <td className="ib-table__dim"><TimeText iso={lab.CreatedAt}>{formatListDateTime(lab.CreatedAt)}</TimeText></td>
                <td className="ib-table__dim"><TimeText iso={lab.ExpiresAt}>{formatListDateTime(lab.ExpiresAt)}</TimeText></td>
                <td><span className="inline-flex flex-wrap items-center gap-1.5"><TestLabStatusBadge status={lab.Status} />{lab.Queue && lab.Queue.Position > 0 && <QueueBadge position={lab.Queue.Position} length={lab.Queue.Length} reason={lab.Queue.Reason} />}{lab.ImageWarning && <ImageWarningIcon />}{lab.Expired && <Badge size="sm">{t("admin.labs.testLabs.expired")}</Badge>}</span></td>
                <td className="ib-table__actions"><span className="inline-flex items-center gap-1">
                  <HoverTooltip text={t("admin.labs.detail.open")}>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`${t("admin.labs.detail.open")}: ${lab.ExerciseName}, ${testLabAuthor(lab)}`} onClick={() => onDetails(lab)}>
                      <Info aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </HoverTooltip>
                  {canWrite && <HoverTooltip text={t("admin.labs.testLabs.terminate")}>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[var(--ib-danger)] hover:bg-[var(--ib-danger-bg)] hover:text-[var(--ib-danger)]" aria-label={`${t("admin.labs.testLabs.terminate")}: ${lab.ExerciseName}, ${testLabAuthor(lab)}`} onClick={() => onTerminate(lab)}>
                      <Power aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </HoverTooltip>}
                </span></td>
              </tr>)}
            </tbody>}
        </table>
      </TableWrap>
      <TablePagination page={filters.page} pageSize={filters.pageSize} total={total} busy={loading}
        onPage={(page) => onFilters({ page })} onPageSize={(pageSize) => onFilters({ pageSize, page: 1 })} />
    </CardContent>
  </Card>
}
