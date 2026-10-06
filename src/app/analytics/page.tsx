"use client"

import { NoAccess } from "@/components/rbac/NoAccess"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { SectionPage } from "@/components/analytics"
import { OverviewAnalytics } from "@/components/analytics/overview/OverviewAnalytics"
import { t } from "@/i18n/t"

function OverviewAnalyticsPage() {
  return <SectionPage title={t("admin.platformAnalytics.overview.title")} subtitle={t("admin.platformAnalytics.overview.subtitle")} autoRefresh="off">
    <OverviewAnalytics />
  </SectionPage>
}

export default function Page() {
  return <RequirePermission perm="analytics.read" fallback={<NoAccess />}><OverviewAnalyticsPage /></RequirePermission>
}
