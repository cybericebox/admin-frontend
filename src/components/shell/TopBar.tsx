"use client"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"

const ID_ORIGIN =
  process.env.NEXT_PUBLIC_ID_ORIGIN ?? `https://id.${process.env.NEXT_PUBLIC_DOMAIN ?? ""}`

export function TopBar({ title }: { title: string }) {
  const { me, role } = useRole()
  const returnTo = typeof window !== "undefined" ? window.location.href : ""
  const initials = me ? `${me.FirstName?.[0] ?? ""}${me.LastName?.[0] ?? ""}` : ""
  return (
    <header className="frost-panel sticky top-0 z-40 flex items-center justify-between px-6 py-3">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-3">
        {role === "admin_viewer" && (
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t("admin.role.viewOnlyBadge")}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={t("admin.accountMenu")} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground">
            {initials || "?"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={`${ID_ORIGIN}/profile?return_to=${encodeURIComponent(returnTo)}`}>{t("admin.profile")}</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`${ID_ORIGIN}/sign-out?return_to=${encodeURIComponent(returnTo)}`}>{t("admin.signOut")}</a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
