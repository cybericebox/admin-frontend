// Section title per route: the top bar and the document title use it. The longest matching prefix wins;
// an unknown route has no section title (never «Головна», which belongs to the dashboard only).
const ROUTE_TITLES: [prefix: string, key: string][] = [
  ["/dashboard", "admin.nav.dashboard"],
  ["/events", "admin.nav.events"],
  ["/users", "admin.nav.users"],
  ["/analytics", "admin.nav.analyticsOverview"],
  ["/analytics/users", "admin.nav.analyticsUsers"],
  ["/analytics/events", "admin.nav.analyticsEvents"],
  ["/analytics/tasks", "admin.nav.analyticsTasks"],
  ["/analytics/infrastructure", "admin.nav.analyticsInfrastructure"],
  ["/analytics/notifications", "admin.nav.analyticsNotifications"],
  ["/notifications", "admin.nav.notifications"],
  ["/notifications/broadcasts", "admin.nav.notif.broadcasts"],
  ["/notifications/banners", "admin.nav.notif.banners"],
  ["/notifications/templates/in-app", "admin.nav.notif.tplInApp"],
  ["/notifications/templates/email", "admin.nav.notif.tplEmail"],
  ["/notifications/settings", "admin.nav.notif.settings"],
  ["/notifications/logs", "admin.nav.notif.logs"],
  ["/labs", "admin.nav.labs"],
  ["/agents", "admin.nav.agents"],
  ["/resources", "admin.nav.resources"],
  ["/elevations", "admin.nav.elevations"],
  ["/audit", "admin.nav.audit"],
  ["/errors", "admin.nav.errors"],
  ["/settings", "admin.nav.settings"],
]

// usePathname ends with a slash (trailingSlash export), the prefixes do not.
export function routeTitleKey(pathname: string): string | null {
  const here = pathname.replace(/\/$/, "") || "/"
  let best: [string, string] | null = null
  for (const entry of ROUTE_TITLES) {
    const [prefix] = entry
    if ((here === prefix || here.startsWith(prefix + "/")) && (!best || prefix.length > best[0].length)) best = entry
  }
  return best ? best[1] : null
}
