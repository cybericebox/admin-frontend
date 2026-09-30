"use client"

import Link from "next/link"
import { ExternalLink, Power } from "lucide-react"
import { ResourceCell } from "@/components/infrastructure/ResourceCell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FieldHelp } from "@/components/ui/field-help"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Input } from "@/components/ui/input"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { TablePagination } from "@/components/ui/table-pagination"
import type { TestLab } from "@/api/infrastructure"
import { exercisesOrigin } from "@/lib/origins"
import { formatDateTime } from "@/lib/locale"
import { t } from "@/i18n/t"

export type TestLabsFilters = { search: string; page: number; pageSize: number }

const STATUS_STYLE: Record<string, string> = {
  creating: "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]",
  ready: "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]",
  failed: "bg-[var(--ib-danger-bg)] text-[var(--ib-danger)]",
  unknown: "bg-secondary/40 text-muted-foreground",
}

export function TestLabStatusBadge({ status }: { status: string }) {
  const known = status in STATUS_STYLE
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[known ? status : "unknown"]}`}>{t(`admin.labs.testLabs.status.${known ? status : "unknown"}`)}</span>
}

export function testLabAuthor(lab: TestLab): string {
  return lab.AuthorName || lab.AuthorEmail
}

export function TestLabsTable({ filters, searchInput, onSearchInput, onFilters, items, total, loading, error, errorCause, canWrite, onRetry, onTerminate }: {
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
}) {
  const block = "flex min-h-64 items-center justify-center"
  return <Card id="test-labs">
    <CardHeader><CardTitle className="flex items-center gap-1.5 text-base">{t("admin.labs.testLabs.title")}<FieldHelp text={t("admin.labs.testLabs.titleHelp")} /></CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input type="search" value={searchInput} onChange={(event) => onSearchInput(event.target.value)} placeholder={t("admin.labs.testLabs.search")} aria-label={t("admin.labs.testLabs.search")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-sm" />
        <FieldHelp text={t("admin.labs.testLabs.searchHelp")} />
      </div>
      <div className="relative" aria-busy={loading}>
        {error ? <LoadError message={error} error={errorCause} onRetry={onRetry} className={block} />
          : items === null ? <LoadingArea className={block} label={t("admin.loading")} />
          : items.length === 0 ? <EmptyState message={t(filters.search ? "admin.labs.testLabs.emptyFiltered" : "admin.labs.testLabs.empty")} className={block} />
          : <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.testLabs.col.author")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.testLabs.col.exercise")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.testLabs.col.variant")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.resources.cpu")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.resources.memory")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.testLabs.col.created")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.testLabs.col.until")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.labs.testLabs.col.status")}</th>
                  {canWrite && <th scope="col" className="w-12 px-3 py-2"><span className="sr-only">{t("admin.labs.testLabs.col.actions")}</span></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((lab) => <tr key={lab.ID} className="border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2"><Link href={`/users/detail?id=${encodeURIComponent(lab.AuthorID)}`} className="block break-words font-medium text-primary hover:underline">{testLabAuthor(lab)}</Link>{lab.AuthorName && <span className="block break-all text-xs text-muted-foreground">{lab.AuthorEmail}</span>}</td>
                  <td className="px-3 py-2">
                    <HoverTooltip text={t("admin.labs.testLabs.openExercise")}>
                      <a href={`${exercisesOrigin}/detail?id=${encodeURIComponent(lab.ExerciseID)}`} target="_blank" rel="noopener noreferrer" aria-label={`${t("admin.labs.testLabs.openExercise")}: ${lab.ExerciseName}`}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-md text-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        <span className="break-words font-medium">{lab.ExerciseName}</span>
                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    </HoverTooltip>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{lab.VariantNumber > 0 ? t("admin.labs.testLabs.variant", { number: lab.VariantNumber }) : t("admin.labs.testLabs.noVariant")}</td>
                  <td className="px-3 py-2"><ResourceCell resources={lab.Resources} kind="cpu" /></td>
                  <td className="px-3 py-2"><ResourceCell resources={lab.Resources} kind="memory" /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(lab.CreatedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(lab.ExpiresAt)}</td>
                  <td className="px-3 py-2"><span className="inline-flex flex-wrap items-center gap-1.5"><TestLabStatusBadge status={lab.Status} />{lab.Expired && <span className="inline-flex rounded-md bg-secondary/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">{t("admin.labs.testLabs.expired")}</span>}</span></td>
                  {canWrite && <td className="px-3 py-2">
                    <HoverTooltip text={t("admin.labs.testLabs.terminate")}>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[var(--ib-danger)] hover:bg-[var(--ib-danger-bg)] hover:text-[var(--ib-danger)]" aria-label={`${t("admin.labs.testLabs.terminate")}: ${lab.ExerciseName}, ${testLabAuthor(lab)}`} onClick={() => onTerminate(lab)}>
                        <Power aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </HoverTooltip>
                  </td>}
                </tr>)}
              </tbody>
            </table>
          </div>}
      </div>
      <TablePagination page={filters.page} pageSize={filters.pageSize} total={total} busy={loading}
        onPage={(page) => onFilters({ page })} onPageSize={(pageSize) => onFilters({ pageSize, page: 1 })} />
    </CardContent>
  </Card>
}
