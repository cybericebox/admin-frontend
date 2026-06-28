"use client"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRole } from "@/lib/useRole"
import { apiPost } from "@/api/client"
import { t } from "@/i18n/t"

const ID_ORIGIN =
  process.env.NEXT_PUBLIC_ID_ORIGIN ?? `https://id.${process.env.NEXT_PUBLIC_DOMAIN ?? ""}`

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
  if (typeof window !== "undefined") window.location.href = `${ID_ORIGIN}/sign-in`
}

export function TopBar({ title }: { title: string }) {
  const { me, role } = useRole()
  const returnTo = typeof window !== "undefined" ? window.location.href : ""
  const initials = me ? `${me.FirstName?.[0] ?? ""}${me.LastName?.[0] ?? ""}` : ""
  const fullName = me ? `${me.FirstName} ${me.LastName}`.trim() || me.Email : ""
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
          <DropdownMenuTrigger
            aria-label={t("admin.accountMenu")}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-medium text-secondary-foreground"
          >
            {me?.Avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- static export, unoptimized images
              <img
                src={me.Avatar}
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
              <a href={`${ID_ORIGIN}/profile?return_to=${encodeURIComponent(returnTo)}`}>{t("admin.profile")}</a>
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
