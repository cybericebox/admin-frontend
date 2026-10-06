"use client"

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { fetchMe, type Me } from "@/lib/auth"
import { isBackendUnreachable, onServiceRestored, reportServiceUnavailable } from "@/lib/serviceStatus"

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
  /** The session check failed (5xx / network error): neither signed in nor signed out. */
  error: unknown
  /** Runs the session check again. */
  retry: () => void
  permissions: string[]
  can: (required: string) => boolean
}

const RoleContext = createContext<RoleState>({
  me: null,
  role: null,
  isLoading: true,
  error: null,
  retry: () => {},
  permissions: [],
  can: () => false,
})

const noPermissions: string[] = []

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const runRef = useRef(0)

  const load = useCallback(() => {
    const run = ++runRef.current
    void fetchMe()
      .then((m) => { if (run === runRef.current) { setMe(m); setError(null); setIsLoading(false) } })
      .catch((err: unknown) => {
        if (run !== runRef.current) return
        setMe(null)
        // The backend cannot be reached: the service gate probes and shows its overlay, the loader stays, and the check re-runs when the gate sees the backend back.
        if (isBackendUnreachable(err)) { setError(null); reportServiceUnavailable(); return }
        setError(err ?? new Error("session check failed"))
        setIsLoading(false)
      })
  }, [])

  // «Спробувати ще раз»: back to the loader while the check runs again.
  const retry = useCallback(() => { setIsLoading(true); load() }, [load])

  useEffect(() => {
    const runs = runRef
    load()
    const unsubscribe = onServiceRestored(load)
    return () => { runs.current++; unsubscribe() }
  }, [load])

  const role = (me?.Role as Role | undefined) ?? null
  const permissions = me?.Permissions ?? noPermissions
  const can = useCallback(
    (required: string) => permissions.some((h) => covers(h, required)),
    [permissions],
  )

  return (
    <RoleContext.Provider value={{ me, role, isLoading, error, retry, permissions, can }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole(): RoleState {
  return useContext(RoleContext)
}
