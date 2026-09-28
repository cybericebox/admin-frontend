"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Bell, Users, Puzzle, ChevronDown, ChevronRight, CalendarDays, Server, Settings, X, PanelLeftClose, PanelLeftOpen, ChartNoAxesCombined } from "lucide-react"
import { Logo } from "@/components/brand/Logo"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"

type Child = { href: string; label: string; perm?: string }
type Item = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  perm?: string
  children?: Child[]
}
type Section = { divider?: boolean; label?: string; items: Item[] }

const SECTIONS: Section[] = [
  { items: [{ href: "/dashboard", label: "admin.nav.dashboard", icon: LayoutDashboard }] },
  { divider: true, label: "admin.nav.section.content", items: [
    { href: "/events", label: "admin.nav.events", icon: CalendarDays, perm: "events.read" },
    { href: "/exercises", label: "admin.nav.exercises", icon: Puzzle, perm: "exercises.read" },
  ] },
  { divider: true, items: [{ href: "/users", label: "admin.nav.users", icon: Users, perm: "users.read" }] },
  { divider: true, items: [{
    href: "/analytics", label: "admin.nav.analytics", icon: ChartNoAxesCombined,
    children: [
      { href: "/analytics/users", label: "admin.nav.analyticsUsers", perm: "users.read" },
      { href: "/analytics/notifications", label: "admin.nav.analyticsNotifications", perm: "notifications.templates.read" },
    ],
  }] },
  {
    divider: true,
    items: [{
      href: "/notifications", label: "admin.nav.notifications", icon: Bell,
      children: [
        { href: "/notifications/logs", label: "admin.nav.notif.logs", perm: "notifications.templates.read" },
        { href: "/notifications/settings", label: "admin.nav.notif.settings", perm: "notifications.settings.read" },
        { href: "/notifications/templates/in-app", label: "admin.nav.notif.tplInApp", perm: "notifications.templates.read" },
        { href: "/notifications/templates/email", label: "admin.nav.notif.tplEmail", perm: "notifications.templates.read" },
      ],
    }],
  },
  { divider: true, label: "admin.nav.section.platform", items: [
    { href: "/labs", label: "admin.nav.labs", icon: Server, perm: "infrastructure.read" },
    { href: "/settings", label: "admin.nav.settings", icon: Settings, perm: "platform.settings.read" },
  ] },
]

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
        .map((it) => ({ ...it, children: it.children?.filter((c) => !c.perm || can(c.perm)) }))
        .filter((it) => !it.children || it.children.length > 0),
    }))
    .filter((s) => s.items.length > 0)

  return (
    <aside className={`flex h-full shrink-0 flex-col bg-[var(--ib-brand)] text-[var(--ib-on-brand)] ${collapsed ? "w-[var(--ib-admin-rail-w)]" : "w-[var(--ib-admin-side-w)]"}`} aria-label={t("admin.shell.title")}>
      <div className={`flex min-h-[64px] items-center gap-3 border-b border-[var(--ib-brand-line)] ${collapsed ? "justify-center px-1" : "px-4"}`}>
        <Logo size={32} />
        <div className={`min-w-0 leading-tight ${collapsed ? "sr-only" : ""}`}>
          <span className="block truncate text-sm font-semibold">Cyber <span className="text-[var(--ib-ice-on-brand)]">ICE</span> Box</span>
          <span className="block text-xs text-[var(--ib-on-brand-3)]">{t("admin.shell.title")}</span>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label="Закрити меню" className="ml-auto rounded p-1.5 hover:bg-[var(--ib-brand-hover)] md:hidden"><X className="h-5 w-5" /></button>}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="Розділи адміністрування">
        {sections.map((section) => (
          <div key={section.items[0].href} className="flex flex-col gap-1">
            {section.divider && <div className="my-2 h-px bg-[var(--ib-brand-line)]" />}
            {section.label && !collapsed && <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ib-on-brand-3)]">{t(section.label)}</p>}
            {section.items.map((it) =>
              it.children && it.children.length > 0
                ? <NavGroup key={it.href} item={it} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} onExpand={onToggleCollapse} />
                : <NavLink key={it.href} href={it.href} label={t(it.label)} icon={it.icon} active={pathname === it.href || pathname.startsWith(it.href + "/")} onNavigate={onNavigate} collapsed={collapsed} />,
            )}
          </div>
        ))}
      </nav>
      {onToggleCollapse && <div className="border-t border-[var(--ib-brand-line)] p-2"><button type="button" onClick={onToggleCollapse} aria-label={collapsed ? "Розгорнути панель" : "Згорнути панель"} title={collapsed ? "Розгорнути панель" : "Згорнути панель"} className={`${itemBase} ${idleCls} ${collapsed ? "justify-center px-2" : ""}`}>{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span>Згорнути панель</span></>}</button></div>}
    </aside>
  )
}

function NavLink({ href, label, icon: Icon, active, onNavigate, collapsed }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean; onNavigate?: () => void; collapsed?: boolean }) {
  return (
    <Link href={href} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined} onClick={onNavigate} className={`${itemBase} ${collapsed ? "justify-center px-2" : ""} ${active ? activeCls : idleCls}`}>
      <Icon className="h-4 w-4" />
      {!collapsed && label}
    </Link>
  )
}

function NavGroup({ item, pathname, onNavigate, collapsed, onExpand }: { item: Item; pathname: string; onNavigate?: () => void; collapsed?: boolean; onExpand?: () => void }) {
  const groupActive = pathname.startsWith(item.href)
  const [expanded, setExpanded] = useState(false)
  const open = expanded || groupActive
  const Icon = item.icon
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => {
          if (collapsed) { setExpanded(true); onExpand?.() }
          else setExpanded((v) => !v)
        }}
        aria-label={collapsed ? t(item.label) : undefined}
        title={collapsed ? t(item.label) : undefined}
        aria-expanded={collapsed ? false : open}
        className={`${itemBase} ${collapsed ? "justify-center px-2" : "justify-between"} ${groupActive ? activeCls : idleCls}`}
      >
        <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{!collapsed && t(item.label)}</span>
        {!collapsed && (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
      </button>
      {open && !collapsed && (
        <div className="ml-5 flex flex-col gap-1 border-l border-[var(--ib-brand-line)] pl-2">
          {item.children!.map((c) => {
            const active = pathname === c.href || pathname.startsWith(c.href + "/")
            return (
              <Link key={c.href} href={c.href} aria-current={active ? "page" : undefined} onClick={onNavigate} className={`${itemBase} ${active ? activeCls : idleCls}`}>
                {t(c.label)}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
