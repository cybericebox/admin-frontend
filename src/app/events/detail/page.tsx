"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { EventAdminDetail } from "@/components/events/EventAdminDetail"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"

function Detail() {
  const id = useSearchParams().get("id") ?? ""
  return <EventAdminDetail key={id} id={id} />
}

export default function Page() {
  return <Suspense fallback={<LoadingArea label={t("admin.loading")} />}><Detail /></Suspense>
}
