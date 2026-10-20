"use client"

import { useEffect } from "react"
import { installChunkRecovery } from "@/lib/chunkRecovery"
import { ErrorPage } from "@/components/ErrorPage"
import { t } from "@/i18n/t"

// Segment error boundary: replaces Next's built-in «This page couldn't load» fallback.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    installChunkRecovery(window).recover(error)
    // details stay out of the UI; developers see them in the console
    if (process.env.NODE_ENV !== "production") console.error(error)
  }, [error])

  return <ErrorPage mode="block" status={500} title={t("error.page.title")} text={t("error.page.body")} onRetry={() => installChunkRecovery(window).retry(error, retry)} error={error} report />
}
