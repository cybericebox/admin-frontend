"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Bell, Users, CalendarDays, FlaskConical, Server, Settings } from "lucide-react"
import { Wordmark } from "@/components/brand/Wordmark"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; superOnly?: boolean }

const ITEMS: Item[] = [
  { href: "/dashboard", label: "admin.nav.dashboard", icon: LayoutDashboard },
  { href: "/notifications", label: "admin.nav.notifications", icon: Bell },
  { href: "/users", label: "admin.nav.users", icon: Users },
  { href: "/events", label: "admin.nav.events", icon: CalendarDays },
  { href: "/exercises", label: "admin.nav.exercises", icon: FlaskConical },
  { href: "/labs", label: "admin.nav.labs", icon: Server },
  { href: "/settings", label: "admin.nav.settings", icon: Settings, superOnly: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const { canManagePlatform } = useRole()
  const items = ITEMS.filter((i) => !i.superOnly || canManagePlatform)
  return (
    <aside className="frost-panel sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-1 p-3">
      <div className="mb-4 px-2 pt-2"><Wordmark size="md" /></div>
      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = pathname.startsWith(it.href)
          const Icon = it.icon
          return (
            <Link
              key={it.href}
              href={it.href}
              className={
                "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors " +
                (active
                  ? "frost-panel text-foreground before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary before:shadow-[0_0_10px_var(--frost-glow)]"
                  : "text-muted-foreground hover:bg-accent/10")
              }
            >
              <Icon className="h-4 w-4" />
              {t(it.label)}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
