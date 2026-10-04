"use client"

import { createContext, useContext } from "react"
import type { PlatformPeriod } from "./usePlatformPeriod"

// What SectionPage shares with the resources rendered inside it.
export type SectionContextValue = {
  period: PlatformPeriod
  autoRefresh: boolean
  reportUpdated: (at: number) => void
  reportBusy: (delta: 1 | -1) => void
  reportForbidden: (forbidden: boolean) => void
}

export const SectionContext = createContext<SectionContextValue | null>(null)

/** The period (and auto-refresh state) of the enclosing SectionPage. */
export function useSectionContext(): SectionContextValue {
  const ctx = useContext(SectionContext)
  if (!ctx) throw new Error("useSectionContext must be used inside SectionPage")
  return ctx
}
