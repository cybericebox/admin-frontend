"use client"

import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NotificationsAnalytics } from "@/components/analytics/mail/NotificationsAnalytics"

export default function Page() {
  return <RequirePermission perm="analytics.read"><NotificationsAnalytics /></RequirePermission>
}
