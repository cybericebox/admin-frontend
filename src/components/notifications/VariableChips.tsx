"use client"
import { t } from "@/i18n/t"

export type NotifVariable = { Name: string; Description: string; Default: string }

// A row of clickable chips, one per available template variable. Clicking a chip
// inserts its `{{.Name}}` token via onInsert (the parent puts it at the caret of
// the last-focused field).
export function VariableChips({
  variables,
  onInsert,
}: {
  variables: NotifVariable[]
  onInsert: (token: string) => void
}) {
  if (variables.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {t("admin.notif.tpl.variables")}
      </span>
      {variables.map((v) => (
        <button
          key={v.Name}
          type="button"
          title={v.Description}
          onClick={() => onInsert(`{{.${v.Name}}}`)}
          className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 font-mono text-xs text-foreground transition-colors hover:bg-accent/30"
        >
          {v.Name}
        </button>
      ))}
    </div>
  )
}
