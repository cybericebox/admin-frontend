"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

// The page moved: «Пошта» and the old notification statistics are one page now.
export default function Page() {
  const router = useRouter()
  useEffect(() => { router.replace("/analytics/notifications") }, [router])
  return null
}
