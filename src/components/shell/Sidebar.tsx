"use client"
import { Fragment, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Bell, Users, ChevronDown, ChevronRight, CalendarDays, Server, Settings, X, PanelLeftClose, PanelLeftOpen, ChartNoAxesCombined, ExternalLink, Puzzle } from "lucide-react"
import { BRAND_HEAD, BRAND_TAIL } from "@/i18n/brand"
import { Logo } from "@/components/brand/Logo"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"
import { exercisesOrigin } from "@/lib/origins"
import { withReturnTo } from "@/lib/accountMenu"
import { HoverTooltip } from "@/components/ui/hover-tooltip"

// perm: one permission, or a list of which any grants the item. exact: active only on this very path.
type Child = { divider?: boolean; href: string; label: string; perm?: string | string[]; exact?: boolean }
type Item = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  perm?: string
  // Opens another platform app (full navigation, not a Next.js route) with return_to back here.
  external?: boolean
  children?: Child[]
}
type Section = { divider?: boolean; label?: string; items: Item[] }

const SECTIONS: Section[] = [
  { items: [{ href: "/dashboard", label: "admin.nav.dashboard", icon: LayoutDashboard }] },
  { divider: true, label: "admin.nav.section.content", items: [
    { href: "/events", label: "admin.nav.events", icon: CalendarDays, perm: "events.read" },
    { href: exercisesOrigin, label: "admin.nav.exercises", icon: Puzzle, perm: "exercises.read", external: true },
  ] },
  { divider: true, items: [{ href: "/users", label: "admin.nav.users", icon: Users, perm: "users.read" }] },
  { divider: true, items: [{
    href: "/analytics", label: "admin.nav.analytics", icon: ChartNoAxesCombined,
    children: [
      { href: "/analytics", label: "admin.nav.analyticsOverview", perm: "analytics.read", exact: true },
      { href: "/analytics/users", label: "admin.nav.analyticsUsers", perm: ["analytics.read", "users.read"] },
      { href: "/analytics/events", label: "admin.nav.analyticsEvents", perm: "analytics.read" },
      { href: "/analytics/tasks", label: "admin.nav.analyticsTasks", perm: "analytics.read" },
      { href: "/analytics/infrastructure", label: "admin.nav.analyticsInfrastructure", perm: "analytics.read" },
      { href: "/analytics/mail", label: "admin.nav.analyticsMail", perm: "analytics.read" },
      { href: "/analytics/notifications", label: "admin.nav.analyticsNotifications", perm: "notifications.templates.read" },
    ],
  }] },
  {
    divider: true,
    items: [{
      href: "/notifications", label: "admin.nav.notifications", icon: Bell,
      children: [
        { href: "/notifications/broadcasts", label: "admin.nav.notif.broadcasts", perm: "notifications.broadcast" },
        { href: "/notifications/banners", label: "admin.nav.notif.banners", perm: "notifications.banners.read" },
        { href: "/notifications/templates/in-app", label: "admin.nav.notif.tplInApp", perm: "notifications.templates.read", divider: true },
        { href: "/notifications/templates/email", label: "admin.nav.notif.tplEmail", perm: "notifications.templates.read" },
        { href: "/notifications/settings", label: "admin.nav.notif.settings", perm: "notifications.settings.read" },
        { href: "/notifications/logs", label: "admin.nav.notif.logs", perm: "notifications.templates.read", divider: true },
      ],
    }],
  },
  { divider: true, label: "admin.nav.section.platform", items: [
    { href: "/labs", label: "admin.nav.labs", icon: Server, perm: "infrastructure.read" },
    { href: "/settings", label: "admin.nav.settings", icon: Settings, perm: "platform.settings.read" },
  ] },
]

// Collapsed rail: icon-only items name themselves in a tooltip to the right (hover and focus).
function RailTip({ collapsed, label, children }: { collapsed?: boolean; label: string; children: React.ReactElement }) {
  if (!collapsed) return children
  return <HoverTooltip text={label} side="right" className="flex w-full">{children}</HoverTooltip>
}

const itemBase = "flex min-h-9 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ib-on-brand)]"
const activeCls = "bg-[var(--ib-brand-active)] text-[var(--ib-on-brand)]"
const idleCls = "text-[var(--ib-on-brand-2)] hover:bg-[var(--ib-brand-hover)] hover:text-[var(--ib-on-brand)]"

export function Sidebar({ onNavigate, onClose, collapsed = false, onToggleCollapse }: { onNavigate?: () => void; onClose?: () => void; collapsed?: boolean; onToggleCollapse?: () => void }) {
  const pathname = usePathname()
  const { can } = useRole()

  const sections = SECTIONS
    .map((s) => ({
      ...s,
      items: s.items
        .filter((it) => !it.perm || can(it.perm))
        .map((it) => ({ ...it, children: it.children?.filter((c) => !c.perm || (Array.isArray(c.perm) ? c.perm.some(can) : can(c.perm))) }))
        .filter((it) => !it.children || it.children.length > 0),
    }))
    .filter((s) => s.items.length > 0)

  return (
    <aside className={`flex h-full shrink-0 flex-col bg-[var(--ib-brand)] text-[var(--ib-on-brand)] ${collapsed ? "w-[var(--ib-admin-rail-w)]" : "w-[var(--ib-admin-side-w)]"}`} aria-label={t("admin.shell.title")}>
      <div className={`flex min-h-[64px] items-center gap-3 border-b border-[var(--ib-brand-line)] ${collapsed ? "justify-center px-1" : "px-4"}`}>
        <Logo size={32} />
        <div className={`min-w-0 leading-tight ${collapsed ? "sr-only" : ""}`}>
          <span className="block truncate text-sm font-semibold">{BRAND_HEAD}<span className="text-[var(--ib-ice-on-brand)]">ICE</span>{BRAND_TAIL}</span>
          <span className="block text-xs text-[var(--ib-on-brand-3)]">{t("admin.shell.title")}</span>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label={t("admin.shell.closeMenu")} className="ml-auto rounded p-1.5 hover:bg-[var(--ib-brand-hover)] md:hidden"><X className="h-5 w-5" /></button>}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label={t("admin.shell.navLabel")}>
        {sections.map((section) => (
          <div key={section.items[0].href} className="flex flex-col gap-1">
            {section.divider && <div className="my-2 h-px bg-[var(--ib-brand-line)]" />}
            {section.label && !collapsed && <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ib-on-brand-3)]">{t(section.label)}</p>}
            {section.items.map((it) =>
              it.children && it.children.length > 0
                ? <NavGroup key={it.href} item={it} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} onExpand={onToggleCollapse} />
                : it.external
                  ? <ExternalNavLink key={it.href} href={it.href} label={t(it.label)} icon={it.icon} collapsed={collapsed} />
                  : <NavLink key={it.href} href={it.href} label={t(it.label)} icon={it.icon} active={pathname === it.href || pathname.startsWith(it.href + "/")} onNavigate={onNavigate} collapsed={collapsed} />,
            )}
          </div>
        ))}
      </nav>
      {onToggleCollapse && <div className="border-t border-[var(--ib-brand-line)] p-2"><RailTip collapsed={collapsed} label={t("admin.shell.expandPanel")}><button type="button" onClick={onToggleCollapse} aria-label={t(collapsed ? "admin.shell.expandPanel" : "admin.shell.collapsePanel")} className={`${itemBase} ${idleCls} ${collapsed ? "justify-center px-2" : ""}`}>{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span>{t("admin.shell.collapsePanel")}</span></>}</button></RailTip></div>}
    </aside>
  )
}

function NavLink({ href, label, icon: Icon, active, onNavigate, collapsed }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean; onNavigate?: () => void; collapsed?: boolean }) {
  return (
    <RailTip collapsed={collapsed} label={label}>
      <Link href={href} aria-label={collapsed ? label : undefined} aria-current={active ? "page" : undefined} onClick={onNavigate} className={`${itemBase} ${collapsed ? "justify-center px-2" : ""} ${active ? activeCls : idleCls}`}>
        <Icon className="h-4 w-4" />
        {!collapsed && label}
      </Link>
    </RailTip>
  )
}

function ExternalNavLink({ href, label, icon: Icon, collapsed }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; collapsed?: boolean }) {
  const returnTo = typeof window !== "undefined" ? window.location.href : ""
  return (
    <RailTip collapsed={collapsed} label={label}>
      <a href={withReturnTo(href, returnTo)} aria-label={collapsed ? label : undefined} className={`${itemBase} ${collapsed ? "justify-center px-2" : ""} ${idleCls}`}>
        <Icon className="h-4 w-4" />
        {!collapsed && <><span className="flex-1">{label}</span><ExternalLink aria-hidden="true" className="h-3.5 w-3.5 text-[var(--ib-on-brand-3)]" /></>}
      </a>
    </RailTip>
  )
}

function NavGroup({ item, pathname, onNavigate, collapsed, onExpand }: { item: Item; pathname: string; onNavigate?: () => void; collapsed?: boolean; onExpand?: () => void }) {
  const groupActive = pathname.startsWith(item.href)
  const [expanded, setExpanded] = useState(false)
  const open = expanded || groupActive
  const Icon = item.icon
  return (
    <div className="flex flex-col gap-1">
      <RailTip collapsed={collapsed} label={t(item.label)}>
        <button
          type="button"
          onClick={() => {
            if (collapsed) { setExpanded(true); onExpand?.() }
            else setExpanded((v) => !v)
          }}
          aria-label={collapsed ? t(item.label) : undefined}
          aria-expanded={collapsed ? false : open}
          className={`${itemBase} ${collapsed ? "justify-center px-2" : "justify-between"} ${groupActive ? activeCls : idleCls}`}
        >
          <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{!collapsed && t(item.label)}</span>
          {!collapsed && (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
        </button>
      </RailTip>
      {open && !collapsed && (
        <div className="ml-5 flex flex-col gap-1 border-l border-[var(--ib-brand-line)] pl-2">
          {item.children!.map((c, index) => {
            const active = pathname === c.href || (!c.exact && pathname.startsWith(c.href + "/"))
            return (
              <Fragment key={c.href}>
                {c.divider && index > 0 && <hr className="my-1 h-px border-0 bg-[var(--ib-brand-line)]" />}
                <Link href={c.href} aria-current={active ? "page" : undefined} onClick={onNavigate} className={`${itemBase} ${active ? activeCls : idleCls}`}>
                  {t(c.label)}
                </Link>
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
