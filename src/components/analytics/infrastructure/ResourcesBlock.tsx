"use client"

import { AnalyticsBlock, DataTable, type Column } from "@/components/analytics"
import { ResourceCell } from "@/components/infrastructure/ResourceCell"
import { t } from "@/i18n/t"
import type { InfrastructureResource, LabKind } from "./types"
import type { LabResources } from "@/api/infrastructure"

const P = "admin.platformAnalytics.infrastructure."

type Row = { kind: LabKind; resources: LabResources | undefined }

/** What the labs of each kind use right now (live usage, else requested). */
export function ResourcesBlock({ res }: { res: InfrastructureResource }) {
  const source = res.data?.Resources
  const rows: Row[] | undefined = res.data && [
    { kind: "event", resources: source?.Event }, { kind: "moderators", resources: source?.Moderators }, { kind: "test", resources: source?.Test },
  ]
  const columns: Column<Row>[] = [
    { key: "kind", header: t(P + "kinds.kind"), cell: (row) => <span className="font-medium text-foreground">{t(P + `kinds.${row.kind}`)}</span> },
    { key: "cpu", header: t("admin.labs.resources.cpu"), cell: (row) => <ResourceCell resources={row.resources} kind="cpu" /> },
    { key: "memory", header: t("admin.labs.resources.memory"), cell: (row) => <ResourceCell resources={row.resources} kind="memory" /> },
  ]
  return <AnalyticsBlock title={t(P + "resources.title")} hint={t(P + "resources.hint")}>
    <DataTable ariaLabel={t(P + "resources.title")} columns={columns} rows={rows} rowKey={(row) => row.kind}
      loading={res.loading} error={res.error} onRetry={res.reload} errorMessage={t(P + "resources.error")}
      emptyMessage={t(P + "resources.error")} minHeight={160} />
  </AnalyticsBlock>
}
