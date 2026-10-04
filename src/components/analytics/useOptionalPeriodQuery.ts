"use client"

import { useContext } from "react"
import { SectionContext } from "./sectionContext"

/** The period range of the enclosing SectionPage, resolved when called; empty outside one. */
export function useOptionalPeriodQuery() {
  const ctx = useContext(SectionContext)
  return () => (ctx ? ctx.period.resolve() : {})
}
