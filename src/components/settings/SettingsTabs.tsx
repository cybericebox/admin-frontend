"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/utils/cn"
import { t } from "@/i18n/t"

const TABS = [
  { href: "/settings", labelKey: "admin.settings.tab.general" },
  { href: "/settings/mail", labelKey: "admin.settings.tab.mail" },
]

/** Sub-pages of «Налаштування»: every tab needs only platform.settings.read. */
export function SettingsTabs() {
  const pathname = (usePathname() ?? "").replace(/\/$/, "") || "/"
  return (
    <nav aria-label={t("admin.settings.tabsLabel")} className="inline-flex h-9 w-fit items-center rounded-lg bg-muted p-1 text-muted-foreground">
      {TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
              active ? "bg-background text-foreground" : "hover:text-foreground",
            )}
          >
            {t(tab.labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}
