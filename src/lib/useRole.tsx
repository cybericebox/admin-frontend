"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { fetchMe, type Me } from "@/lib/auth"

export type Role = "user" | "viewer" | "admin" | "super_admin"

export interface RoleState {
  me: Me | null
  role: Role | null
  isLoading: boolean
  canManage: boolean        // admin | super_admin
  canManagePlatform: boolean // super_admin
}

const RoleContext = createContext<RoleState>({
  me: null,
  role: null,
  isLoading: true,
  canManage: false,
  canManagePlatform: false,
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
  const canManage = role === "admin" || role === "super_admin"
  const canManagePlatform = role === "super_admin"

  return (
    <RoleContext.Provider value={{ me, role, isLoading, canManage, canManagePlatform }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole(): RoleState {
  return useContext(RoleContext)
}
