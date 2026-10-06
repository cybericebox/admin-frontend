"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { t } from "@/i18n/t"

const TABS = [
  { href: "/settings", labelKey: "admin.settings.tab.general" },
  { href: "/settings/mail", labelKey: "admin.settings.tab.mail" },
]

/** Sub-pages of «Налаштування»: every tab needs only platform.settings.read. */
export function SettingsTabs() {
  const pathname = (usePathname() ?? "").replace(/\/$/, "") || "/"
  return (
    <nav aria-label={t("admin.settings.tabsLabel")} className="ib-tabs ib-tabs--page">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined}>{t(tab.labelKey)}</Link>
      ))}
    </nav>
  )
}
