"use client"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"
import { PageLoader } from "@/components/ui/spinner"
import { SiteBannerBar } from "./SiteBanner"
import { NoAccessScreen } from "./NoAccessScreen"
import { SignInRedirect } from "./SignInRedirect"
import { MobileDrawer } from "./MobileDrawer"
import { PageTitleContext, type PageMeta } from "./PageTitle"
import type { Crumb } from "@/components/ui/breadcrumbs"
import { routeTitleKey } from "./routeTitles"
import { useMediaQuery } from "./useMediaQuery"

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { role, isLoading } = useRole()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const desktop = useMediaQuery("(min-width: 768px)")
  // A page that knows its own title and trail (PageHeader with an event name) reports them; otherwise the route's section title is used.
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null)
  const pageTitle = pageMeta?.title ?? null
  const sectionKey = routeTitleKey(pathname)
  const sectionTitle = sectionKey ? t(sectionKey) : null
  useEffect(() => {
    const page = pageTitle ?? sectionTitle
    document.title = page ? t("admin.title.template", { page }) : t("meta.title")
  }, [pageTitle, sectionTitle])

  // The drawer only exists on narrow screens: widening the window closes it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the breakpoint, an external browser state
    if (desktop) setMenuOpen(false)
  }, [desktop])

  // Top bar trail: the page's own crumbs, else just the section as plain text (a top-level page never links to itself).
  const crumbs: readonly Crumb[] = pageMeta?.crumbs ?? [{ label: sectionTitle ?? t("admin.shell.title") }]

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

  return (
    <PageTitleContext.Provider value={setPageMeta}>
      <div className="flex h-dvh overflow-hidden bg-background">
        <a className="ib-skip" href="#main">{t("admin.shell.skip")}</a>
        {desktop && <Sidebar />}
        {!desktop && <MobileDrawer open={menuOpen} onOpenChange={setMenuOpen} />}
        <div className="flex min-w-0 flex-1 flex-col bg-[var(--ib-surface)]">
          <TopBar crumbs={crumbs} onMenuClick={() => setMenuOpen(true)} />
          <SiteBannerBar />
          <main id="main" tabIndex={-1} data-admin-scroll-root className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">{children}</main>
        </div>
      </div>
    </PageTitleContext.Provider>
  )
}
