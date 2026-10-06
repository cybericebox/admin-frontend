"use client"
import { Fragment, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeft, Bell, BellRing, CalendarCheck, CalendarDays, ChartNoAxesCombined, ChevronDown, ClipboardList, ExternalLink, Gauge, Layers,
  LayoutDashboard, Mail, Megaphone, MessageSquare, Puzzle, ScrollText, Send, Server, Settings, ShieldCheck, Bug, Settings2, Cpu, Users, UserSearch, X, Activity, Cable, CalendarClock,
  type LucideIcon,
} from "lucide-react"
import { BRAND_HEAD, BRAND_TAIL } from "@/i18n/brand"
import { Logo } from "@/components/brand/Logo"
import { ELEVATION_READ_PERM } from "@/lib/elevationPermission"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"
import { exercisesOrigin } from "@/lib/origins"
import { withReturnTo } from "@/lib/accountMenu"
import { readEventReturn, type EventReturn } from "@/lib/returnOrigin"

// perm: one permission, or a list of which any grants the item. exact: active only on this very path.
// divider: a thin line before the item (inside a group, the blocks of its items).
type Child = { href: string; label: string; icon: LucideIcon; perm?: string | string[]; exact?: boolean; divider?: boolean }
type Item = {
  href: string
  label: string
  icon: LucideIcon
  perm?: string
  // Opens another platform app (full navigation, not a Next.js route) with return_to back here.
  external?: boolean
  // A thin line after the item (Огляд stands apart, like «Підготовка заходу» in the event sidebar).
  dividerAfter?: boolean
}
type Group = { id: string; label: string; icon: LucideIcon; href: string; children: Child[] }

// Same shape as the event /manage sidebar: rows of one style, then collapsible groups.
const ITEMS: Item[] = [
  { href: "/dashboard", label: "admin.nav.dashboard", icon: LayoutDashboard, dividerAfter: true },
  { href: "/events", label: "admin.nav.events", icon: CalendarDays, perm: "events.read" },
  { href: exercisesOrigin, label: "admin.nav.exercises", icon: Puzzle, perm: "exercises.read", external: true },
  { href: "/users", label: "admin.nav.users", icon: Users, perm: "users.read" },
]

const GROUPS: Group[] = [
  {
    id: "analytics", href: "/analytics", label: "admin.nav.analytics", icon: ChartNoAxesCombined,
    children: [
      { href: "/analytics", label: "admin.nav.analyticsOverview", icon: Gauge, perm: "analytics.read", exact: true },
      { href: "/analytics/users", label: "admin.nav.analyticsUsers", icon: UserSearch, perm: ["analytics.read", "users.read"] },
      { href: "/analytics/events", label: "admin.nav.analyticsEvents", icon: CalendarCheck, perm: "analytics.read" },
      { href: "/analytics/tasks", label: "admin.nav.analyticsTasks", icon: ClipboardList, perm: "analytics.read" },
      { href: "/analytics/infrastructure", label: "admin.nav.analyticsInfrastructure", icon: Activity, perm: "analytics.read" },
      { href: "/analytics/notifications", label: "admin.nav.analyticsNotifications", icon: MessageSquare, perm: "analytics.read" },
    ],
  },
  {
    // Three blocks split by thin dividers: actions, settings (templates + notification settings), log.
    id: "notifications", href: "/notifications", label: "admin.nav.notifications", icon: Bell,
    children: [
      { href: "/notifications/broadcasts", label: "admin.nav.notif.broadcasts", icon: Send, perm: "notifications.broadcast" },
      { href: "/notifications/banners", label: "admin.nav.notif.banners", icon: Megaphone, perm: "notifications.banners.read" },
      { href: "/notifications/templates/in-app", label: "admin.nav.notif.tplInApp", icon: BellRing, perm: "notifications.templates.read", divider: true },
      { href: "/notifications/templates/email", label: "admin.nav.notif.tplEmail", icon: Mail, perm: "notifications.templates.read" },
      { href: "/notifications/settings", label: "admin.nav.notif.settings", icon: Settings2, perm: "notifications.settings.read" },
      { href: "/notifications/logs", label: "admin.nav.notif.logs", icon: ScrollText, perm: "notifications.templates.read", divider: true },
    ],
  },
  {
    id: "platform", href: "", label: "admin.nav.section.platform", icon: Layers,
    children: [
      { href: "/labs", label: "admin.nav.labs", icon: Server, perm: "infrastructure.read" },
      { href: "/agents", label: "admin.nav.agents", icon: Cable, perm: "infrastructure.read" },
      { href: "/resources", label: "admin.nav.resources", icon: CalendarClock, perm: "infrastructure.read" },
      { href: "/elevations", label: "admin.nav.elevations", icon: Cpu, perm: ELEVATION_READ_PERM },
      { href: "/settings", label: "admin.nav.settings", icon: Settings, perm: "platform.settings.read" },
      { href: "/audit", label: "admin.nav.audit", icon: ShieldCheck, perm: "platform.audit.read" },
      { href: "/errors", label: "admin.nav.errors", icon: Bug, perm: "platform.errors.read" },
    ],
  },
]

// usePathname ends with a slash (trailingSlash export), the hrefs do not.
const isActive = (pathname: string, href: string, exact?: boolean) => {
  const here = pathname.replace(/\/$/, "") || "/"
  return here === href || (!exact && here.startsWith(href + "/"))
}

export function Sidebar({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const pathname = usePathname()
  const { can } = useRole()
  const allowed = (perm?: string | string[]) => !perm || (Array.isArray(perm) ? perm.some(can) : can(perm))

  const items = ITEMS.filter((item) => allowed(item.perm))
  const groups = GROUPS
    .map((group) => ({ ...group, children: group.children.filter((child) => allowed(child.perm)) }))
    .filter((group) => group.children.length > 0)

  // A group opens on its own when the current page is inside it; the reader can open others.
  const [openGroupID, setOpenGroupID] = useState<string | null>(() => groups.find((group) => group.children.some((child) => isActive(pathname, child.href, child.exact)))?.id ?? null)

  // Set when the user came from an event's /manage (a validated `?from=`, kept for the session).
  const [origin, setOrigin] = useState<EventReturn | null>(null)
  useEffect(() => {
    let storage: Storage | null = null
    try { storage = window.sessionStorage } catch { /* Blocked storage: only the address counts. */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, unknown on the server
    setOrigin(readEventReturn(window.location.search ?? "", storage))
  }, [])

  return (
    <aside className="ib-admin-side h-full w-[var(--ib-admin-side-w)] shrink-0 bg-[var(--ib-brand)] text-[var(--ib-on-brand)]" aria-label={t("admin.shell.title")}>
      <div className="flex min-h-[64px] items-center gap-3 border-b border-[var(--ib-brand-line)] px-4">
        <Logo size={32} />
        <div className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">{BRAND_HEAD}<span className="text-[var(--ib-ice-on-brand)]">ICE</span>{BRAND_TAIL}</span>
          <span className="block text-xs text-[var(--ib-on-brand-3)]">{t("admin.shell.title")}</span>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label={t("admin.shell.closeMenu")} className="ml-auto rounded p-1.5 hover:bg-[var(--ib-brand-hover)] md:hidden"><X className="h-5 w-5" /></button>}
      </div>
      <nav className="ib-admin-side__nav" aria-label={t("admin.shell.navLabel")}>
        {items.map((item) => <Fragment key={item.href}>
          {item.external
            ? <ExternalNavLink item={item} />
            : <Link className="ib-admin-side__item" href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined} onClick={onNavigate}>
              <item.icon aria-hidden="true" /><span className="ib-admin-side__label">{t(item.label)}</span>
            </Link>}
          {item.dividerAfter && <hr className="ib-admin-side__rule" />}
        </Fragment>)}
        {groups.map((group) => {
          const isOpen = openGroupID === group.id
          return (
            <section className="event-manage-sidebar__group" key={group.id} aria-label={t(group.label)}>
              <button className="ib-admin-side__item event-manage-sidebar__heading" type="button" aria-expanded={isOpen} aria-controls={`admin-group-${group.id}`} onClick={() => setOpenGroupID((current) => current === group.id ? null : group.id)}>
                <group.icon aria-hidden="true" /><span className="ib-admin-side__label">{t(group.label)}</span><ChevronDown size={15} aria-hidden="true" />
              </button>
              <div id={`admin-group-${group.id}`} className="event-manage-sidebar__items" hidden={!isOpen}>
                {group.children.map((child, index) => (
                  <Fragment key={child.href}>
                    {child.divider && index > 0 && <hr className="event-manage-sidebar__divider" />}
                    <Link className="ib-admin-side__item" href={child.href} aria-current={isActive(pathname, child.href, child.exact) ? "page" : undefined} onClick={onNavigate}>
                      <child.icon aria-hidden="true" /><span className="ib-admin-side__label">{t(child.label)}</span>
                    </Link>
                  </Fragment>
                ))}
              </div>
            </section>
          )
        })}
      </nav>
      {origin && (
        <div className="ib-admin-side__foot">
          <a className="ib-admin-side__item" href={origin.url}><ArrowLeft aria-hidden="true" /><span className="ib-admin-side__label">{origin.name ? t("admin.nav.returnToEvent", { name: origin.name }) : t("admin.nav.returnToEventNoName")}</span></a>
        </div>
      )}
    </aside>
  )
}

function ExternalNavLink({ item }: { item: Item }) {
  const returnTo = typeof window !== "undefined" ? window.location.href : ""
  return (
    <a className="ib-admin-side__item" href={withReturnTo(item.href, returnTo)}>
      <item.icon aria-hidden="true" /><span className="ib-admin-side__label">{t(item.label)}</span><ExternalLink aria-hidden="true" className="!h-3.5 !w-3.5 text-[var(--ib-on-brand-3)]" />
    </a>
  )
}
