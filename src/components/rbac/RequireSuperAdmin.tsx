"use client"
import { useRole } from "@/lib/useRole"

export function RequireSuperAdmin({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canManagePlatform } = useRole()
  return <>{canManagePlatform ? children : fallback}</>
}
