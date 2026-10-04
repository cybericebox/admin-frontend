"use client"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"
import { PageLoader } from "@/components/ui/spinner"
import { SiteBannerBar } from "./SiteBanner"
import { NoAccessScreen } from "./NoAccessScreen"
import { SignInRedirect } from "./SignInRedirect"

const TITLES: Record<string, string> = {
  "/dashboard": "admin.nav.dashboard",
  "/notifications": "admin.nav.notifications",
  "/analytics": "admin.nav.analytics",
  "/users": "admin.nav.users",
  "/events": "admin.nav.events",
  "/labs": "admin.nav.labs",
  "/agents": "admin.nav.agents",
  "/audit": "admin.nav.audit",
  "/errors": "admin.nav.errors",
  "/settings": "admin.nav.settings",
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { role, isLoading } = useRole()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  if (isLoading) {
    return <PageLoader label={t("admin.loading")} />
  }

  // Not authenticated (401) → straight to the id sign-in with return_to, behind the loader.
  if (role === null) {
    return <SignInRedirect />
  }

  // Authenticated but unprivileged (403) → the no-access screen (do NOT loop to sign-in).
  if (role === "user") {
    return <NoAccessScreen />
  }

  const titleKey = Object.keys(TITLES).find((p) => pathname.startsWith(p)) ?? "/dashboard"
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden md:block"><Sidebar /></div>
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-[color-mix(in_srgb,var(--ib-ink)_45%,transparent)]" aria-label={t("admin.shell.closeNav")} onClick={() => setMenuOpen(false)} />
          <div className="relative h-full w-fit"><Sidebar onClose={() => setMenuOpen(false)} onNavigate={() => setMenuOpen(false)} /></div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col bg-[var(--ib-surface)]">
        <TopBar title={t(TITLES[titleKey])} onMenuClick={() => setMenuOpen(true)} />
        <SiteBannerBar />
        <main data-admin-scroll-root className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
