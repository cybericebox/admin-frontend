"use client"
import { createContext, useContext, useEffect } from "react"
import type { Crumb } from "@/components/ui/breadcrumbs"

export type PageMeta = { title: string | null; crumbs: readonly Crumb[] | null }

// The shell owns document.title and the top bar crumbs; a page header that knows its own title (an event name, a user) and
// its trail reports both here.
export const PageTitleContext = createContext<(meta: PageMeta | null) => void>(() => {})

export function usePageMeta(title: string | null | undefined, crumbs?: readonly Crumb[]) {
  const setMeta = useContext(PageTitleContext)
  // Callers pass a fresh array every render: key the effect on its content.
  const crumbsKey = crumbs ? JSON.stringify(crumbs) : ""
  useEffect(() => {
    setMeta({ title: title ?? null, crumbs: crumbsKey ? (JSON.parse(crumbsKey) as Crumb[]) : null })
    return () => setMeta(null)
  }, [title, crumbsKey, setMeta])
}
