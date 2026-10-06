"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { GlobalSettingsTab } from "@/components/notifications/GlobalSettingsTab"

export default function Page() {
  return (
    <RequirePermission
      perm="notifications.settings.read"
      fallback={<NoAccess />}
    >
      <div className="frost-in"><GlobalSettingsTab /></div>
    </RequirePermission>
  )
}
