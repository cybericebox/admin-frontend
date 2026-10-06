"use client"

import { NoAccess } from "@/components/common/NoAccess"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { SectionPage } from "@/components/analytics"
import { UsersAnalytics } from "@/components/analytics/users/UsersAnalytics"
import { t } from "@/i18n/t"

function UsersAnalyticsPage() {
  return <SectionPage title={t("admin.platformAnalytics.users.title")} subtitle={t("admin.platformAnalytics.users.subtitle")}>
    <UsersAnalytics />
  </SectionPage>
}

export default function Page() {
  return <RequirePermission perm="analytics.read" fallback={<NoAccess />}><UsersAnalyticsPage /></RequirePermission>
}
