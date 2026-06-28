"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Bell, Users, ChevronDown, ChevronRight } from "lucide-react"
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
type Section = { divider?: boolean; items: Item[] }

const SECTIONS: Section[] = [
  { items: [{ href: "/dashboard", label: "admin.nav.dashboard", icon: LayoutDashboard }] },
  { divider: true, items: [{ href: "/users", label: "admin.nav.users", icon: Users, perm: "users.read" }] },
  {
    divider: true,
    items: [{
      href: "/notifications", label: "admin.nav.notifications", icon: Bell, perm: "notifications.templates.read",
      children: [
        { href: "/notifications/stats", label: "admin.nav.notif.stats" },
        { href: "/notifications/logs", label: "admin.nav.notif.logs" },
        { href: "/notifications/settings", label: "admin.nav.notif.settings", perm: "notifications.settings.read" },
        { href: "/notifications/templates/in-app", label: "admin.nav.notif.tplInApp" },
        { href: "/notifications/templates/email", label: "admin.nav.notif.tplEmail" },
      ],
    }],
  },
]

const itemBase = "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
const activeCls = "frost-panel text-foreground before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary before:shadow-[0_0_10px_var(--frost-glow)]"
const idleCls = "text-muted-foreground hover:bg-accent/10"

export function Sidebar() {
  const pathname = usePathname()
  const { can } = useRole()

  const sections = SECTIONS
    .map((s) => ({
      ...s,
      items: s.items
        .filter((it) => !it.perm || can(it.perm))
        .map((it) => ({ ...it, children: it.children?.filter((c) => !c.perm || can(c.perm)) })),
    }))
    .filter((s) => s.items.length > 0)

  return (
    <aside className="frost-panel sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-1 p-3">
      <div className="mb-4 flex items-center gap-2 px-2 pt-2">
        <Logo size={26} />
        <span className="text-sm font-semibold tracking-tight text-foreground">{t("admin.shell.title")}</span>
      </div>
      <nav className="flex flex-col gap-1">
        {sections.map((section, si) => (
          <div key={section.items[0].href} className="flex flex-col gap-1">
            {section.divider && <div className="my-2 h-px bg-border" />}
            {section.items.map((it) =>
              it.children && it.children.length > 0
                ? <NavGroup key={it.href} item={it} pathname={pathname} />
                : <NavLink key={it.href} href={it.href} label={t(it.label)} icon={it.icon} active={pathname === it.href || pathname.startsWith(it.href + "/")} />,
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean }) {
  return (
    <Link href={href} className={`${itemBase} ${active ? activeCls : idleCls}`}>
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  )
}

function NavGroup({ item, pathname }: { item: Item; pathname: string }) {
  const groupActive = pathname.startsWith(item.href)
  const [open, setOpen] = useState(groupActive)
  useEffect(() => { if (groupActive) setOpen(true) }, [groupActive])
  const Icon = item.icon
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${itemBase} justify-between ${groupActive ? activeCls : idleCls}`}
      >
        <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{t(item.label)}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="ml-4 flex flex-col gap-1 border-l border-border pl-2">
          {item.children!.map((c) => {
            const active = pathname === c.href || pathname.startsWith(c.href + "/")
            return (
              <Link key={c.href} href={c.href} className={`${itemBase} ${active ? activeCls : idleCls}`}>
                {t(c.label)}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
