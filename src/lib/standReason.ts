import { t } from "@/i18n/t"

/** A stand or lab reason as stored: "ImageUnavailable: <image>" reads as a sentence, anything else stays as it is. */
export function standReasonText(reason: string): string {
  const match = /^ImageUnavailable(?::\s*(.*))?$/.exec(reason.trim())
  if (!match) return reason
  return match[1] ? t("admin.labs.imageUnavailable.image", { image: match[1] }) : t("admin.labs.imageUnavailable")
}
