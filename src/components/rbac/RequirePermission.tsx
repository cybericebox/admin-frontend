"use client"
import { useRole } from "@/lib/useRole"

// Renders children only when the user holds (covers) the required permission.
export function RequirePermission({
  perm,
  children,
  fallback = null,
}: {
  perm: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { can } = useRole()
  return <>{can(perm) ? children : fallback}</>
}
