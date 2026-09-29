"use client"

import { RequirePermission } from "@/components/rbac/RequirePermission"
import { SectionPage } from "@/components/analytics"
import { TasksAnalytics } from "@/components/analytics/tasks/TasksAnalytics"
import { t } from "@/i18n/t"

function TasksAnalyticsPage() {
  return <SectionPage title={t("admin.platformAnalytics.tasks.title")} subtitle={t("admin.platformAnalytics.tasks.subtitle")}>
    <TasksAnalytics />
  </SectionPage>
}

export default function Page() {
  return <RequirePermission perm="analytics.read"><TasksAnalyticsPage /></RequirePermission>
}
