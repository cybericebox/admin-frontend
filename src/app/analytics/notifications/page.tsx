"use client"

import { RequirePermission } from "@/components/rbac/RequirePermission"
import { StatisticsTab } from "@/components/notifications/StatisticsTab"

export default function Page() {
  return <RequirePermission perm="notifications.templates.read"><StatisticsTab /></RequirePermission>
}
