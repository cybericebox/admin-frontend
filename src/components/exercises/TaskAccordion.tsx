"use client"

import { useState } from "react"
import { useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { emptyTask, type DraftFormValues } from "@/lib/exerciseSchemas"
import { TaskForm } from "./TaskForm"

/** TaskAccordion — a variant's tasks: accordion + add/remove. */
export function TaskAccordion({
  variantIndex,
  disabled,
}: {
  variantIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Tasks` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const [open, setOpen] = useState<number | null>(0)
  const rows = useWatch({ control, name }) ?? []

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("admin.exDraft.tasks.title")}
        </h3>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { append(emptyTask()); setOpen(fields.length) }}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTask.add")}
          </Button>
        )}
      </div>

      {fields.map((field, ti) => (
        <div key={field.id} className="rounded-md border border-border">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-sm"
            onClick={() => setOpen(open === ti ? null : ti)}
          >
            <span className="font-medium">
              {rows[ti]?.Name || `${t("admin.exTask.untitled")} ${ti + 1}`}
            </span>
            {open === ti ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {open === ti && (
            <div className="space-y-3 border-t border-border p-3">
              <TaskForm variantIndex={variantIndex} taskIndex={ti} disabled={disabled} />
              {!disabled && (
                <Button type="button" variant="destructive" size="sm" onClick={() => { remove(ti); setOpen(null) }}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  {t("admin.exTask.remove")}
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
