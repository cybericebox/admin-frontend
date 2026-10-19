"use client"

import { Spinner } from "@/components/ui/spinner"
import { useSecondsSince } from "@/lib/usePolling"
import { t } from "@/i18n/t"

// «Оновлено щойно» (under 5 s) or «Оновлено N с тому» + the crest while a refresh is in flight. The slot for
// the crest is always reserved so the line does not jump.
export function RefreshIndicator({ updatedAt, refreshing }: { updatedAt: number | null; refreshing: boolean }) {
  const seconds = useSecondsSince(updatedAt)
  return <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
    <span className="inline-flex w-5 justify-center">{refreshing && <Spinner size="sm" label={t("admin.labs.refreshing")} />}</span>
    {seconds !== null && <span className="tabular-nums" aria-live="off">{seconds < 5 ? t("admin.labs.updatedNow") : t("admin.labs.updatedAgo", { count: seconds })}</span>}
  </span>
}
