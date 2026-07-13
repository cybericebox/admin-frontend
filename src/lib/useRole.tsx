"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { fetchMe, type Me } from "@/lib/auth"

export type Role = "user" | "admin_viewer" | "admin" | "super_admin"

// covers mirrors the backend rbac.covers: a held permission grants a required one
// when held is "*", exactly equal, or a dotted-prefix ancestor of required.
function covers(held: string, required: string): boolean {
  return held === "*" || held === required || required.startsWith(held + ".")
}

export interface RoleState {
  me: Me | null
  role: Role | null
  isLoading: boolean
  permissions: string[]
  can: (required: string) => boolean
}

const RoleContext = createContext<RoleState>({
  me: null,
  role: null,
  isLoading: true,
  permissions: [],
  can: () => false,
})

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then((m) => { if (!cancelled) setMe(m) })
      .catch(() => { if (!cancelled) setMe(null) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const role = (me?.Role as Role | undefined) ?? null
  // Me (from the DS-verbatim lib/auth.ts) has no Permissions field, but the
  // /api/auth/me payload carries it — read it through an augmented view.
  const permissions = ((me as unknown as { Permissions?: string[] } | null)?.Permissions) ?? []
  const can = useCallback(
    (required: string) => permissions.some((h) => covers(h, required)),
    [permissions],
  )

  return (
    <RoleContext.Provider value={{ me, role, isLoading, permissions, can }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole(): RoleState {
  return useContext(RoleContext)
}
