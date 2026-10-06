"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { LogsTab } from "@/components/notifications/LogsTab"

export default function Page() {
  return (
    <RequirePermission
      perm="notifications.templates.read"
      fallback={<NoAccess />}
    >
      <LogsTab />
    </RequirePermission>
  )
}
