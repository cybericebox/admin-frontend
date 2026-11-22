"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { t } from "@/i18n/t"

const TABS = [
  { href: "/notifications/templates/email", labelKey: "admin.nav.notif.tplEmail" },
  { href: "/notifications/templates/in-app", labelKey: "admin.nav.notif.tplInApp" },
]

/** E-mail and in-app templates are one place with two tabs: the same list, the other channel. */
export function TemplateChannelTabs() {
  const pathname = (usePathname() ?? "").replace(/\/$/, "")
  return <nav aria-label={t("admin.notif.templates.channels")} className="ib-tabs ib-tabs--page min-w-0 max-w-full">
    {TABS.map((tab) => <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined}>{t(tab.labelKey)}</Link>)}
  </nav>
}
