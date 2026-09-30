"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { EventAdminDetail } from "@/components/events/EventAdminDetail"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"

function Detail() {
  const params = useSearchParams()
  const id = params.get("id") ?? ""
  return <EventAdminDetail key={id} id={id} initialTab={params.get("tab")} />
}

export default function Page() {
  return <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><Detail /></Suspense>
}
