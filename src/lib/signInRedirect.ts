import { idOrigin } from "@/lib/origins"

// Where an unauthenticated page (401) sends the visitor: the ID sign-in with the
// current address as return_to. Returns "" when there is nowhere to go (ID host
// unknown, or the address already is the sign-in page), so two redirects can
// never bounce each other.
export function signInRedirectTarget(returnTo: string, id: string = idOrigin): string {
  if (!id) return ""
  if (returnTo === id || returnTo.startsWith(`${id}/`) || returnTo.startsWith(`${id}?`)) return ""
  return `${id}/sign-in?return_to=${encodeURIComponent(returnTo)}`
}
