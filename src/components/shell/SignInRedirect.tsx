"use client"
import { useEffect } from "react"
import { t } from "@/i18n/t"
import { PageLoader } from "@/components/ui/spinner"
import { signInRedirectTarget } from "@/lib/signInRedirect"

// A page that needs a session (401): no card, no button. The address is replaced with
// the ID sign-in (return_to = this page), so Back does not bounce, and the crest loader
// shows meanwhile.
export function SignInRedirect() {
  useEffect(() => {
    const target = signInRedirectTarget(window.location.href)
    if (target) window.location.replace(target)
  }, [])
  return <PageLoader label={t("auth.redirecting")} />
}
