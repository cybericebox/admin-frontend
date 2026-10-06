"use client"
import { Fragment } from "react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRole } from "@/lib/useRole"
import { apiPost, mediaUrl } from "@/api/client"
import { t } from "@/i18n/t"
import { Menu } from "lucide-react"
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs"
import { THEME_OPTIONS, ThemeSwitch, useThemeChoice } from "./ThemeSwitch"
import type { ThemeChoice } from "@/lib/theme"
import { InboxButton } from "./InboxButton"
import { exercisesOrigin, idOrigin } from "@/lib/origins"
import { ACCOUNT_MENU_ICON_PROPS, ACCOUNT_MENU_ICONS, ACCOUNT_MENU_LABELS, accountMenu } from "@/lib/accountMenu"
import { initials } from "@/lib/initials"
import { CookieSettingsMenuItem } from "@/components/consent/CookieSettingsMenuItem"
import { FeedbackMenuItem } from "@/components/FeedbackMenuItem"

// Unified account menu (lib/accountMenu): same entries, labels and icons in every app.
const ICON_CLASS = "shrink-0 text-muted-foreground group-focus:text-accent-foreground"

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
  if (typeof window !== "undefined") window.location.href = `${idOrigin}/sign-in/`
}

// The top bar shows the trail only; the page's one h1 lives in PageHeader.
export function TopBar({ crumbs, onMenuClick }: { crumbs: readonly Crumb[]; onMenuClick?: () => void }) {
  const { me, role } = useRole()
  const [themeChoice, selectTheme] = useThemeChoice()
  const returnTo = typeof window !== "undefined" ? window.location.href : ""
  // Everyone past the admin shell is admin-tier, and admin-tier opens the catalog.
  const adminTier = role !== null && role !== "user"
  const entries = accountMenu(
    "admin",
    { adminTier, catalog: adminTier, returnTo },
    { id: idOrigin, admin: "", exercises: exercisesOrigin },
  )
  const avatarInitials = initials(me?.FirstName, me?.LastName, me?.Email)
  const fullName = me ? `${me.FirstName} ${me.LastName}`.trim() || me.Email : ""
  return (
    <header className="ib-topbar sticky top-0 z-40 justify-between max-md:px-4!">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" aria-label={t("admin.shell.openMenu")} onClick={onMenuClick} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent md:hidden"><Menu className="h-5 w-5" /></button>
        <Breadcrumbs items={crumbs} className="min-w-0" />
      </div>
      <div className="flex items-center gap-3">
        {/* On narrow screens the theme switch and the view-only badge live in the account menu. */}
        <div className="flex items-center gap-3 max-md:hidden">
          <ThemeSwitch />
          <span className="h-5 w-px bg-border" aria-hidden="true" />
        </div>
        <InboxButton defaultTab="requestsIfOpen" />
        {role === "admin_viewer" && (
          <span className="text-[length:var(--ib-fs-13)] font-medium text-muted-foreground max-md:hidden">
            {t("admin.role.viewOnlyBadge")}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("admin.accountMenu")}
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--ib-brand)] text-xs font-medium text-[var(--ib-on-brand)]"
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
              avatarInitials
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-medium">{fullName}</span>
              <span className="text-xs font-normal text-muted-foreground">{me?.Email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="md:hidden">
              {role === "admin_viewer" && <DropdownMenuLabel className="text-[length:var(--ib-fs-13)] font-medium text-muted-foreground">{t("admin.role.viewOnlyBadge")}</DropdownMenuLabel>}
              <DropdownMenuLabel className="text-[length:var(--ib-fs-13)] font-medium text-muted-foreground">{t("theme.label")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={themeChoice} onValueChange={(value) => selectTheme(value as ThemeChoice)}>
                {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
                  <DropdownMenuRadioItem key={value} value={value} className="gap-2"><Icon aria-hidden="true" className="h-4 w-4" />{t(label)}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </div>
            {entries.map((entry, i) => {
              if (entry.kind === "divider") return <DropdownMenuSeparator key={i} />
              if (entry.kind === "cookies") return <Fragment key={i}><CookieSettingsMenuItem /><FeedbackMenuItem /></Fragment>
              if (entry.kind === "signOut") {
                const Icon = ACCOUNT_MENU_ICONS.signOut
                return (
                  <DropdownMenuItem key={i} className="group gap-2" onSelect={(e) => { e.preventDefault(); void signOutAndRedirect() }}>
                    <Icon {...ACCOUNT_MENU_ICON_PROPS} className={ICON_CLASS} />{t(ACCOUNT_MENU_LABELS.signOut)}
                  </DropdownMenuItem>
                )
              }
              const Icon = ACCOUNT_MENU_ICONS[entry.key]
              return (
                <DropdownMenuItem key={entry.key} asChild className="group gap-2">
                  <a href={entry.href}><Icon {...ACCOUNT_MENU_ICON_PROPS} className={ICON_CLASS} />{t(ACCOUNT_MENU_LABELS[entry.key])}</a>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
