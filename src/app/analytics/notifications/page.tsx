"use client"

import { NoAccess } from "@/components/rbac/NoAccess"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NotificationsAnalytics } from "@/components/analytics/notifications/NotificationsAnalytics"

export default function Page() {
  return <RequirePermission perm="analytics.read" fallback={<NoAccess />}><NotificationsAnalytics /></RequirePermission>
}
