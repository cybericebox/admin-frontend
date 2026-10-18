"use client"
import { useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { t } from "@/i18n/t"
import { useScrollActiveTab } from "@/components/ui/useScrollActiveTab"

const TABS = [
  { href: "/settings", labelKey: "admin.settings.tab.general" },
  { href: "/settings/mail", labelKey: "admin.settings.tab.mail" },
  { href: "/settings/tasks", labelKey: "admin.settings.tab.tasks" },
  { href: "/settings/data-retention", labelKey: "admin.settings.tab.dataRetention" },
]

/** Sub-pages of «Налаштування»: every tab needs only platform.settings.read. */
export function SettingsTabs() {
  const pathname = (usePathname() ?? "").replace(/\/$/, "") || "/"
  const list = useRef<HTMLElement>(null)
  useScrollActiveTab(list)
  return (
    <nav ref={list} aria-label={t("admin.settings.tabsLabel")} className="ib-tabs ib-tabs--page ib-tabs--scroll min-w-0 max-w-full">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined}>{t(tab.labelKey)}</Link>
      ))}
    </nav>
  )
}
