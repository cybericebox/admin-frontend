"use client"

import { NoAccess } from "@/components/rbac/NoAccess"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { SectionPage } from "@/components/analytics"
import { EventsAnalytics } from "@/components/analytics/events/EventsAnalytics"
import { t } from "@/i18n/t"

function EventsAnalyticsPage() {
  return <SectionPage title={t("admin.platformAnalytics.events.title")} subtitle={t("admin.platformAnalytics.events.subtitle")}>
    <EventsAnalytics />
  </SectionPage>
}

export default function Page() {
  return <RequirePermission perm="analytics.read" fallback={<NoAccess />}><EventsAnalyticsPage /></RequirePermission>
}
