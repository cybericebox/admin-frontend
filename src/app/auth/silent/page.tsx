"use client"
import { useEffect } from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

function SilentResult() {
  const params = useSearchParams()
  useEffect(() => {
    const authed = params.get("authed") === "1"
    // Same-origin parent only — the iframe always ends on the RP origin.
    window.parent?.postMessage({ type: "cyberice-sso", authed }, window.location.origin)
  }, [params])
  return null
}
export default function Page() {
  return <Suspense><SilentResult /></Suspense>
}
