"use client"
import { createContext, useContext, useEffect } from "react"

// The shell owns document.title; a page header that knows its own title (an event name, a user) reports it here.
export const PageTitleContext = createContext<(title: string | null) => void>(() => {})

export function usePageTitle(title: string | null | undefined) {
  const setTitle = useContext(PageTitleContext)
  useEffect(() => {
    setTitle(title ?? null)
    return () => setTitle(null)
  }, [title, setTitle])
}
