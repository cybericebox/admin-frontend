"use client"

import { Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/**
 * FlagInput — the list of flag values for a task.
 * Semantics: [] → a random flag is generated at deploy time; 1 → a fixed flag;
 * N → one is picked at random at deploy time.
 */
export function FlagInput({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
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
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTask.flag.title")}</span>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTask.flag.add")}
          </Button>
        )}
      </div>
      {value.map((flag, i) => (
        // Index as key: the list is short and rows are edited in place.
        <div key={i} className="flex items-center gap-2">
          <Input
            value={flag}
            disabled={disabled}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
          />
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`remove-flag-${i}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t(semanticsKey)}</p>
    </div>
  )
}
