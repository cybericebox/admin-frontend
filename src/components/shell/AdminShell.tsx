"use client"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"
import { PageLoader } from "@/components/ui/spinner"
import { BannerStack } from "./BannerStack"
import { idOrigin, mainOrigin } from "@/lib/origins"
const SIDEBAR_STORAGE_KEY = "cybericebox.admin.sidebar.collapsed"

const TITLES: Record<string, string> = {
  "/dashboard": "admin.nav.dashboard",
  "/notifications": "admin.nav.notifications",
  "/analytics": "admin.nav.analytics",
  "/users": "admin.nav.users",
  "/events": "admin.nav.events",
  "/exercises": "admin.nav.exercises",
  "/labs": "admin.nav.labs",
  "/settings": "admin.nav.settings",
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { role, isLoading } = useRole()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
      queueMicrotask(() => setCollapsed(stored === "true"))
    } catch { /* Storage may be disabled; the sidebar remains usable. */ }
    const sync = (event: StorageEvent) => {
      if (event.key === SIDEBAR_STORAGE_KEY) setCollapsed(event.newValue === "true")
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try { window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)) } catch { /* Keep the current-tab setting. */ }
  }

  useEffect(() => {
    if (!isLoading && role === null) {
      window.location.assign(`${idOrigin}/sign-in?return_to=${encodeURIComponent(window.location.href)}`)
    }
  }, [isLoading, role])

  if (isLoading) {
    return <PageLoader label={t("admin.loading")} />
  }

  // Not authenticated → bounce to id sign-in with return_to.
  if (role === null) {
    return null
  }

  // Authenticated but unprivileged → no-access panel (do NOT loop to sign-in).
  if (role === "user") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="frost-panel frost-in max-w-md rounded-lg p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">{t("admin.noAccess.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("admin.noAccess.body")}</p>
          <a className="mt-4 inline-block text-sm text-primary hover:underline"
             href={mainOrigin}>{t("admin.noAccess.backToMain")}</a>
        </div>
      </div>
    )
  }

  const titleKey = Object.keys(TITLES).find((p) => pathname.startsWith(p)) ?? "/dashboard"
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden md:block"><Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} /></div>
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-[color-mix(in_srgb,var(--ib-ink)_45%,transparent)]" aria-label="Закрити навігацію" onClick={() => setMenuOpen(false)} />
          <div className="relative h-full w-fit"><Sidebar onClose={() => setMenuOpen(false)} onNavigate={() => setMenuOpen(false)} /></div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col bg-[var(--ib-surface)]">
        <TopBar title={t(TITLES[titleKey])} onMenuClick={() => setMenuOpen(true)} />
        <BannerStack />
        <main data-admin-scroll-root className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
