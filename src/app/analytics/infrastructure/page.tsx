"use client"

import { NoAccess } from "@/components/rbac/NoAccess"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { InfrastructureAnalytics } from "@/components/analytics/infrastructure/InfrastructureAnalytics"

export default function Page() {
  return <RequirePermission perm="analytics.read" fallback={<NoAccess />}><InfrastructureAnalytics /></RequirePermission>
}
