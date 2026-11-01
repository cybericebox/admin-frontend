"use client"
import { useEffect } from "react"
import LogsPage from "./logs/page"

// «/notifications» is the delivery log itself, drawn at once (no empty frame, no navigation); the address then names it.
export default function Page() {
  useEffect(() => { window.history.replaceState(window.history.state, "", `/notifications/logs/${window.location.search}${window.location.hash}`) }, [])
  return <LogsPage />
}
