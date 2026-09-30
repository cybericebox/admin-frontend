"use client"

import { AnalyticsBlock, CsvExportButton, DataTable, useAnalyticsResource, type Column } from "@/components/analytics"
import { t } from "@/i18n/t"
import { roleLabel } from "@/lib/roles"
import type { UsersPerson } from "@/api/platformAnalyticsOverview"
import { formatCount } from "../overview/format"

// Mirrors the backend bound (platformAnalytics.UsersPeopleLimit).
const LIMIT = 100

/**
 * The most active accounts: per-user data, so it is rendered (and fetched) only for a
 * caller holding analytics.users.read. The list ignores the chosen period: it ranks
 * accounts by the events they joined so far.
 */
export function PeopleTable() {
  const { data, loading, error, reload } = useAnalyticsResource<UsersPerson[]>("users/people", {}, { period: false })
  const columns: Column<UsersPerson>[] = [
    { key: "name", header: t("admin.platformAnalytics.users.people.name"), cell: (row) => row.Name || "–", sortValue: (row) => row.Name },
    { key: "email", header: t("admin.platformAnalytics.users.people.email"), cell: (row) => row.Email, sortValue: (row) => row.Email },
    { key: "role", header: t("admin.platformAnalytics.users.people.role"), cell: (row) => roleLabel(row.Role), sortValue: (row) => roleLabel(row.Role) },
    { key: "events", header: t("admin.platformAnalytics.users.people.events"), cell: (row) => formatCount(row.EventsJoined), sortValue: (row) => row.EventsJoined, numeric: true },
    { key: "solves", header: t("admin.platformAnalytics.users.people.solves"), cell: (row) => formatCount(row.Solves), sortValue: (row) => row.Solves, numeric: true },
  ]
  return <AnalyticsBlock title={t("admin.platformAnalytics.users.people.title")} subtitle={t("admin.platformAnalytics.users.people.subtitle", { limit: LIMIT })}
    hint={t("admin.platformAnalytics.users.people.hint")} actions={<CsvExportButton section="users" table="people" disabled={loading || !!error || !data?.length} />}>
    <DataTable columns={columns} rows={data} rowKey={(row) => row.ID} loading={loading} error={error} onRetry={reload} ariaLabel={t("admin.platformAnalytics.users.people.title")}
      emptyMessage={t("admin.platformAnalytics.users.people.empty")} errorMessage={t("admin.platformAnalytics.users.people.error")} defaultSort={{ field: "events", direction: "desc" }} />
  </AnalyticsBlock>
}
