import type { RegistryCheck } from "@/api/imageRegistry/settings"
import { t } from "@/i18n/t"
import { formatListDateTime } from "@/lib/locale"

const KNOWN_REASONS = ["unauthorized"]
const KNOWN_FAILURES = ["unreachable", "rate_limited", "not_found", "not_configured"]

/** The status text of one credential: when it was checked and whether the registry accepted it. */
export function registryCheckText(check: RegistryCheck): string {
  if (check.State === "") return t("admin.imageRegistry.check.never")
  const date = formatListDateTime(check.CheckedAt)
  if (check.State === "ok") return t("admin.imageRegistry.check.ok", { date })
  const reason = t(`admin.imageRegistry.check.reason.${KNOWN_REASONS.includes(check.Reason) ? check.Reason : "other"}`)
  return t("admin.imageRegistry.check.broken", { date, reason })
}

/** The note shown when the last attempt gave no verdict: the previous state stays and the check is retried. */
export function registryRetryText(check: RegistryCheck): string {
  if (!check.Failure) return ""
  const reason = t(`admin.imageRegistry.check.failure.${KNOWN_FAILURES.includes(check.Failure) ? check.Failure : "other"}`)
  return t("admin.imageRegistry.check.retry", { date: formatListDateTime(check.AttemptedAt), reason })
}

/** One credential's last check result. A broken one reads as an error, never by colour alone (the text says it). */
export function RegistryCheckLine({ label, check }: { label: string; check: RegistryCheck }) {
  const retry = registryRetryText(check)
  return (
    <div className="text-sm" data-state={check.State || "unknown"}>
      <span className="font-medium">{label}</span>
      <span className={check.State === "broken" ? "text-destructive" : "text-muted-foreground"}>{`: ${registryCheckText(check)}`}</span>
      {retry && <span className="block text-muted-foreground">{retry}</span>}
    </div>
  )
}
