"use client"

import { HelpCircle } from "lucide-react"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { t } from "@/i18n/t"

// DS field help (tooltip.css .ib-help): 24px target around a 16px icon, name «Довідка», the text itself in aria-describedby.
// A tap or Enter toggles the bubble, hover opens it after 300 ms, Esc closes it. Text over ~120 characters belongs in visible helper text.
export function FieldHelp({ text }: { text: string }) {
  return <HoverTooltip text={text} help describe>
    <button type="button" aria-label={t("ui.fieldHelp")} className="ib-help"><HelpCircle aria-hidden="true" /></button>
  </HoverTooltip>
}
