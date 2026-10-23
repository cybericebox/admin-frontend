"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { BroadcastTemplatesList } from "@/components/notifications/broadcast/BroadcastTemplatesList"

export default function Page() {
  return (
    <RequirePermission perm="notifications.broadcast" fallback={<NoAccess />}>
      <BroadcastTemplatesList />
    </RequirePermission>
  )
}
