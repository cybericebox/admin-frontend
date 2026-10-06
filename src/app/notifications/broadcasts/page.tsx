"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { BroadcastsList } from "@/components/notifications/broadcast/BroadcastsList"

export default function Page() {
  return (
    <RequirePermission perm="notifications.broadcast" fallback={<NoAccess />}>
      <BroadcastsList />
    </RequirePermission>
  )
}
