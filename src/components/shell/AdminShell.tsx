"use client"
import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"
import { Spinner } from "@/components/ui/spinner"

const ID_ORIGIN =
  process.env.NEXT_PUBLIC_ID_ORIGIN ?? `https://id.${process.env.NEXT_PUBLIC_DOMAIN ?? ""}`

const TITLES: Record<string, string> = {
  "/dashboard": "admin.nav.dashboard",
  "/notifications": "admin.nav.notifications",
  "/users": "admin.nav.users",
  "/events": "admin.nav.events",
  "/exercises": "admin.nav.exercises",
  "/labs": "admin.nav.labs",
  "/settings": "admin.nav.settings",
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { role, isLoading } = useRole()
  const pathname = usePathname()

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner label={t("admin.loading")} /></div>
  }

  // Not authenticated → bounce to id sign-in with return_to.
  if (role === null) {
    if (typeof window !== "undefined") {
      window.location.href = `${ID_ORIGIN}/sign-in?return_to=${encodeURIComponent(window.location.href)}`
    }
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
             href={`https://${process.env.NEXT_PUBLIC_DOMAIN ?? ""}`}>{t("admin.noAccess.backToMain")}</a>
        </div>
      </div>
    )
  }

  const titleKey = Object.keys(TITLES).find((p) => pathname.startsWith(p)) ?? "/dashboard"
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={t(TITLES[titleKey])} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
