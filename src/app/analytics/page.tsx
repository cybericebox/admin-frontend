"use client"

import { RequirePermission } from "@/components/rbac/RequirePermission"
import { SectionPage } from "@/components/analytics"
import { EmptyState } from "@/components/ui/empty-state"
import { t } from "@/i18n/t"

// Shell: the section agent replaces the body inside SectionPage.
function OverviewAnalytics() {
  return <SectionPage title={t("admin.platformAnalytics.overview.title")} subtitle={t("admin.platformAnalytics.overview.subtitle")}>
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-card"><EmptyState message={t("admin.platformAnalytics.placeholder")} /></div>
  </SectionPage>
}

export default function Page() {
  return <RequirePermission perm="analytics.read"><OverviewAnalytics /></RequirePermission>
}
