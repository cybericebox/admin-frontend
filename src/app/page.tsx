"use client"
import { useEffect } from "react"
import DashboardPage from "./dashboard/page"

// «/» is the dashboard itself, drawn at once (no empty frame, no navigation); the address then names it.
export default function Page() {
  useEffect(() => { window.history.replaceState(window.history.state, "", `/dashboard/${window.location.search}${window.location.hash}`) }, [])
  return <DashboardPage />
}
