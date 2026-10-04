import { eventDomain, platformHosts } from "@/lib/origins"
import { STORAGE_RETURN_EVENT } from "@/lib/storageKeys"

// Where an admin session came from: only an event's /manage counts (the catalog and the profile are
// shared UI, never an origin). The link from /manage carries `?from=<page>&from_name=<event name>`;
// it is validated against our own event hosts (no open redirects) and kept for the session.
export const FROM_PARAM = "from"
export const FROM_NAME_PARAM = "from_name"
const NAME_MAX = 120

export type EventReturn = { url: string; name: string }

// Tags taken by the platform apps: the first labels of the hosts that sit under the event domain.
function reservedTags(domain: string, hosts: string[]): Set<string> {
  const suffix = `.${domain.toLowerCase()}`
  return new Set(hosts.map((h) => h.toLowerCase()).filter((h) => h.endsWith(suffix)).map((h) => h.slice(0, -suffix.length)))
}

// The /manage address in `value` when it is on an event host of our domain (<tag>.<domain>) over https.
export function validEventReturn(value: string | null | undefined, domain: string = eventDomain, hosts: string[] = platformHosts): string | null {
  if (!value || !domain) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null
    const suffix = `.${domain.toLowerCase()}`
    const host = url.hostname.toLowerCase()
    if (!host.endsWith(suffix)) return null
    const tag = host.slice(0, -suffix.length)
    if (!/^[a-z0-9-]+$/.test(tag) || reservedTags(domain, hosts).has(tag)) return null
    if (url.pathname !== "/manage" && !url.pathname.startsWith("/manage/")) return null
    url.hash = ""
    return url.href
  } catch {
    return null
  }
}

export function readEventReturn(search: string, storage: Pick<Storage, "getItem" | "setItem"> | null, domain: string = eventDomain, hosts: string[] = platformHosts): EventReturn | null {
  const params = new URLSearchParams(search)
  const url = validEventReturn(params.get(FROM_PARAM), domain, hosts)
  if (url) {
    const found = { url, name: (params.get(FROM_NAME_PARAM) ?? "").trim().slice(0, NAME_MAX) }
    try { storage?.setItem(STORAGE_RETURN_EVENT, JSON.stringify(found)) } catch { /* Session storage may be unavailable; the origin lasts for this page. */ }
    return found
  }
  try {
    const stored = JSON.parse(storage?.getItem(STORAGE_RETURN_EVENT) ?? "null") as Partial<EventReturn> | null
    const restored = validEventReturn(stored?.url, domain, hosts)
    return restored ? { url: restored, name: typeof stored?.name === "string" ? stored.name.slice(0, NAME_MAX) : "" } : null
  } catch {
    return null
  }
}

// The link to an event's /manage from admin carries this page, so the event can offer the way back.
export function withAdminOrigin(href: string, adminURL: string): string {
  if (!adminURL) return href
  return `${href}${href.includes("?") ? "&" : "?"}${FROM_PARAM}=${encodeURIComponent(adminURL)}`
}
