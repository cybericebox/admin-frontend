// Browser-facing origins. Every host derives from the one base domain NEXT_PUBLIC_DOMAIN (src/lib/hosts.ts); a missing domain fails
// the build (next.config.ts) and the container start (entrypoint).
import { hosts } from "@/lib/hosts"

const h = hosts()
const origin = (host: string) => `https://${host}`

export const mainHost = h.main
export const apiHost = h.api
export const idHost = h.id
export const adminHost = h.admin
export const exercisesHost = h.exercises
// Event sites are <tag>.<eventDomain>; the theme and consent cookies are shared on this domain.
export const eventDomain = h.eventDomain

export const apiOrigin = origin(apiHost)
export const idOrigin = origin(idHost)
export const mainOrigin = origin(mainHost) || "/"
// The exercise catalog lives in its own app (exercises-frontend).
export const exercisesOrigin = origin(exercisesHost) || "/"

export const platformHosts: string[] = [mainHost, apiHost, idHost, adminHost, exercisesHost].filter(Boolean)

/** True for a platform app host or an event site (<tag>.<eventDomain>). */
export function isPlatformHost(hostname: string, hosts: string[] = platformHosts, domain: string = eventDomain): boolean {
  const h = hostname.toLowerCase()
  return hosts.includes(h) || (!!domain && (h === domain || h.endsWith(`.${domain}`)))
}
