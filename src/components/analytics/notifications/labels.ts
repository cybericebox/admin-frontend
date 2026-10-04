import { t } from "@/i18n/t"
import { mailTransportLabel, notifTypeLabel } from "@/utils/notifType"

/** Label of a recorded mail transport (event / platform / env); rows journaled before the transport was recorded read "unknown". */
export function transportLabel(transport: string): string {
  return transport === "unknown" ? t("admin.platformAnalytics.mail.transport.unknown") : mailTransportLabel(transport)
}

export const typeLabel = notifTypeLabel

/** "12,5%" from a 0..1 ratio. */
export function percent(ratio: number, format: (value: number, options?: Intl.NumberFormatOptions) => string): string {
  return t("admin.platformAnalytics.mail.percent", { value: format(ratio * 100, { maximumFractionDigits: 1 }) })
}
