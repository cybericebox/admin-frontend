// Browser-facing origins. Every host comes from env (NEXT_PUBLIC_*_HOST, bare host, no scheme) and
// is required: next.config.ts fails the build when one is missing and the container entrypoint
// refuses to start. Process env is read by literal name so the bundler can inline it.
const host = (value: string | undefined) => value?.trim() ?? ""
const origin = (h: string) => (h ? `https://${h}` : "")

export const mainHost = host(process.env.NEXT_PUBLIC_MAIN_HOST)
export const apiHost = host(process.env.NEXT_PUBLIC_API_HOST)
export const idHost = host(process.env.NEXT_PUBLIC_ID_HOST)
export const adminHost = host(process.env.NEXT_PUBLIC_ADMIN_HOST)
export const exercisesHost = host(process.env.NEXT_PUBLIC_EXERCISES_HOST)
// Event sites are <tag>.<eventDomain>; the theme and consent cookies are shared on this domain.
export const eventDomain = host(process.env.NEXT_PUBLIC_EVENT_DOMAIN)

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
