import { ApiError } from "@/api/client"
import { t } from "@/i18n/t"
import { errorCode } from "@/components/ui/load-error"
import { feedbackHref } from "@/lib/feedback"

/** A 5xx the backend answered (and journaled): the only failure that gets a reference number. */
export function isServerError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status >= 500
}

/** «{code}-{rid8}»: the platform error code plus the first 8 hex chars of the request id; the code alone is not a reference. */
export function reference(error: unknown): string | undefined {
  if (!isServerError(error) || !error.requestId) return undefined
  const rid = error.requestId.replace(/-/g, "").slice(0, 8).toLowerCase()
  const code = errorCode(error)
  return code === undefined ? rid : `${code}-${rid}`
}

/** The prefilled «Повідомити деталі» mail. A server error carries the reference; a crash the trimmed message, app and build. */
export function reportHref(error: unknown, now = new Date()): string {
  const ref = reference(error)
  const lines = [`${t("error.report.url")}: ${window.location.href}`, `${t("error.report.time")}: ${now.toISOString()}`]
  if (ref) lines.push(`${t("error.report.ref")}: ${ref}`)
  else {
    const message = error instanceof Error ? error.message : String(error ?? "")
    lines.push(`${t("error.report.error")}: ${message.slice(0, 200)}`, `${t("error.report.app")}: ${t("feedback.app")} ${process.env.NEXT_PUBLIC_APP_VERSION ?? ""}`.trim())
  }
  lines.push("", `${t("error.report.did")}`, "")
  const subject = ref ? t("error.report.subjectRef", { ref }) : t("error.report.subject")
  return feedbackHref(subject, lines.join("\n"))
}
