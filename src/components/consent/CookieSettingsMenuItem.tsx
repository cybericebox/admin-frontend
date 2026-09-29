"use client"

import { Cookie } from "lucide-react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { t } from "@/i18n/t"
import { openConsentSettings } from "@/lib/consent"
import { mainOrigin } from "@/lib/origins"

// The Cookie Policy lives on the main site.
export const COOKIE_POLICY_HREF = `${mainOrigin.replace(/\/$/, "")}/cookies`

// «Налаштування файлів cookie» in the account menu, always shown: a link to the cookie policy.
// With JS only the navigation is cancelled (on the native event, so the menu still sees the select
// and closes); the consent panel opens once the menu has handed focus back to its trigger.
export function CookieSettingsMenuItem() {
  return (
    <DropdownMenuItem asChild className="gap-2" onSelect={() => { window.setTimeout(openConsentSettings, 0) }}>
      <a href={COOKIE_POLICY_HREF} onClick={(e) => e.nativeEvent.preventDefault()}>
        <Cookie className="h-4 w-4" aria-hidden="true" />{t("consent.settings")}
      </a>
    </DropdownMenuItem>
  )
}
