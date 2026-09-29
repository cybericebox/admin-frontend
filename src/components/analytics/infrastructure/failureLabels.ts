import { t } from "@/i18n/t"

// Reason codes the backend derives from the lab failure text (see
// queries/platform_analytics_infrastructure.sql, ListPlatformInfraFailures).
const CODES = ["image_pull", "crash_loop", "container_config", "lab_phase_failed", "deploy_timeout", "status_unavailable", "topology_unavailable", "deploy_failed", "unknown"] as const

/** Translated label of a failure reason code; unknown codes read as "other". */
export function failureLabel(code: string): string {
  const known = (CODES as readonly string[]).includes(code) ? code : "other"
  return t(`admin.platformAnalytics.infrastructure.failures.code.${known}`)
}
