"use client"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRole } from "@/lib/useRole"
import { apiPost, mediaUrl } from "@/api/client"
import { t } from "@/i18n/t"
import { Menu } from "lucide-react"
import { ThemeSwitch } from "./ThemeSwitch"
import { InboxButton } from "./InboxButton"
import { idOrigin } from "@/lib/origins"

// Sign out from the ADMIN origin so DeAuthenticate clears this subdomain's local
// token (httpOnly, out of the id app's reach) and deletes the master session
// server-side, then go straight to the id sign-in page. Signing out via the id
// app instead left the admin local-token intact, so a reload re-entered the
// panel; and bouncing back through admin ran the full silent-SSO before the
// client guard could redirect, stranding the user on a loading screen.
async function signOutAndRedirect(): Promise<void> {
  try {
    await apiPost("/api/auth/sign-out", {}, undefined, { required: false })
  } catch {
    // Even if the call fails, fall through to sign-in — the cookie is httpOnly
    // and short-lived; the worst case is a stale token that expires on its own.
  }
  if (typeof window !== "undefined") window.location.href = `${idOrigin}/sign-in`
}

export function TopBar({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) {
  const { me, role } = useRole()
  const returnTo = typeof window !== "undefined" ? window.location.href : ""
  const initials = me ? `${me.FirstName?.[0] ?? ""}${me.LastName?.[0] ?? ""}` : ""
  const fullName = me ? `${me.FirstName} ${me.LastName}`.trim() || me.Email : ""
  return (
    <header className="sticky top-0 z-40 flex min-h-[52px] items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" aria-label="Відкрити меню" onClick={onMenuClick} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent md:hidden"><Menu className="h-5 w-5" /></button>
        <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <ThemeSwitch />
        <span className="h-5 w-px bg-border" aria-hidden="true" />
        <InboxButton />
        {role === "admin_viewer" && (
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t("admin.role.viewOnlyBadge")}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("admin.accountMenu")}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-medium text-secondary-foreground"
          >
            {me?.Picture ? (
              // eslint-disable-next-line @next/next/no-img-element -- static export, unoptimized images
              <img
                src={mediaUrl(me.Picture)}
                alt={fullName}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              initials || "?"
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-medium">{fullName}</span>
              <span className="text-xs font-normal text-muted-foreground">{me?.Email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={`${idOrigin}/profile?return_to=${encodeURIComponent(returnTo)}`}>{t("admin.profile")}</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void signOutAndRedirect() }}>
              {t("admin.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
