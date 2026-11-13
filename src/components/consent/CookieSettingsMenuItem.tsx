"use client"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { t } from "@/i18n/t"
import { openConsentSettings } from "@/lib/consent"
import { ACCOUNT_MENU_ICON_PROPS, ACCOUNT_MENU_ICONS, ACCOUNT_MENU_LABELS } from "@/lib/accountMenu"

// The Cookie Policy link (NEXT_PUBLIC_COOKIES_URL; empty = none). This menu item opens the consent panel on click, so with the setting
// empty it stays an item and only loses its target.
export const COOKIE_POLICY_HREF = process.env.NEXT_PUBLIC_COOKIES_URL

// «Файли cookie» (named «Налаштування файлів cookie») in the account menu, always shown: a link to
// the cookie policy. With JS only the navigation is cancelled (on the native event, so the menu still
// sees the select and closes); the consent panel opens once the menu has handed focus back to its trigger.
export function CookieSettingsMenuItem() {
  const Icon = ACCOUNT_MENU_ICONS.cookies
  return (
    <DropdownMenuItem asChild className="group gap-2" onSelect={() => { window.setTimeout(openConsentSettings, 0) }}>
      <a href={COOKIE_POLICY_HREF} aria-label={t(ACCOUNT_MENU_LABELS.cookiesAria)} onClick={(e) => e.nativeEvent.preventDefault()}>
        <Icon {...ACCOUNT_MENU_ICON_PROPS} className="shrink-0 text-muted-foreground group-focus:text-accent-foreground" />
        <span className="account-menu__label">{t(ACCOUNT_MENU_LABELS.cookies)}</span>
      </a>
    </DropdownMenuItem>
  )
}
