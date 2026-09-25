"use client"

import { Plus } from "lucide-react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RemoveAction } from "./RemoveAction"
import { FieldHelp } from "@/components/ui/field-help"

/**
 * FlagInput — the list of flag values for a task.
 * Semantics: [] → a random flag is generated at deploy time; 1 → a fixed flag;
 * N → one is picked at random at deploy time.
 */
export function FlagInput({
  value,
  onChange,
  disabled,
  errors = [],
}: {
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
  errors?: (string | undefined)[]
}) {
  const semanticsKey =
    value.length === 0
      ? "admin.exTask.flag.semantics0"
      : value.length === 1
        ? "admin.exTask.flag.semantics1"
        : "admin.exTask.flag.semanticsN"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTask.flag.title")}<FieldHelp text={t("admin.exTask.flag.help")} /></span>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTask.flag.add")}
          </Button>
        )}
      </div>
      {value.map((flag, i) => (
        // Index as key: the list is short and rows are edited in place.
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            <Input
              value={flag}
              placeholder="ICE{...}"
              disabled={disabled}
              aria-label={`${t("admin.exTask.flag.title")} ${i + 1}`}
              aria-invalid={Boolean(errors[i])}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
            />
            {!disabled && (
              <RemoveAction ariaLabel={t("admin.exTask.flag.remove")} onClick={() => onChange(value.filter((_, j) => j !== i))} />
            )}
          </div>
          <p role={errors[i] ? "alert" : undefined} className="min-h-4 text-xs text-destructive">{errors[i]}</p>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t(semanticsKey)}</p>
    </div>
  )
}
