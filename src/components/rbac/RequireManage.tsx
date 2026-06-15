"use client"
import { useRole } from "@/lib/useRole"

// Renders children only when the user can mutate (admin/super_admin).
// viewer/user get the optional `fallback` (default: nothing) — used to hide/disable mutation controls.
export function RequireManage({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canManage } = useRole()
  return <>{canManage ? children : fallback}</>
}
