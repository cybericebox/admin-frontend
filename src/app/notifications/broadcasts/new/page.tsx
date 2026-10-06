"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { BroadcastCompose } from "@/components/notifications/broadcast/BroadcastCompose"

export default function Page() {
  return (
    <RequirePermission perm="notifications.broadcast" fallback={<NoAccess />}>
      <BroadcastCompose />
    </RequirePermission>
  )
}
