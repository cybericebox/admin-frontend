"use client"

import { useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { emptyTask, type DraftFormValues } from "@/lib/exerciseSchemas"
import { TaskForm } from "./TaskForm"
import { RemoveAction } from "./RemoveAction"
import { useEditorPosition } from "./EditorPosition"

/** TaskAccordion — a variant's stages: local navigation and one focused editor. */
export function TaskAccordion({
  variantIndex,
  disabled,
}: {
  variantIndex: number
  disabled: boolean
}) {
  const { control, getValues, setValue } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Tasks` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const [selected, setSelected] = useEditorPosition("task")
  const rows = useWatch({ control, name }) ?? []

  function addSharedTask() {
    const nextTask = emptyTask()
    getValues("Variants").forEach((_, index) => {
      if (index === variantIndex) return
      const otherName = `Variants.${index}.Tasks` as const
      setValue(otherName, [...getValues(otherName), { ...nextTask }], { shouldDirty: true })
    })
    append(nextTask)
    setSelected(fields.length)
  }

  function removeSharedTask(taskIndex: number) {
    getValues("Variants").forEach((_, index) => {
      if (index === variantIndex) return
      const otherName = `Variants.${index}.Tasks` as const
      setValue(otherName, getValues(otherName).filter((__, i) => i !== taskIndex), { shouldDirty: true })
    })
    remove(taskIndex)
    setSelected(0)
  }

  const activeIndex = Math.min(selected, Math.max(fields.length - 1, 0))

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("admin.exDraft.tasks.title")}
        </h3>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSharedTask}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTask.add")}
          </Button>
        )}
      </div>

      <div className="exercise-settings-layout min-w-0 gap-4">
        <nav aria-label={t("admin.exDraft.tasks.title")} className="min-w-0 space-y-1 rounded-md border border-border p-2">
          {fields.map((field, ti) => (
            <button key={field.id} type="button" aria-current={activeIndex === ti ? "page" : undefined}
              onClick={() => setSelected(ti)}
              className={`w-full truncate rounded-md px-3 py-2 text-left text-sm ${activeIndex === ti ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {rows[ti]?.Name || `${t("admin.exTask.untitled")} ${ti + 1}`}
            </button>
          ))}
        </nav>
        {fields[activeIndex] && <div key={fields[activeIndex].id} className="min-w-0 space-y-3 rounded-md border border-border p-4">
          <TaskForm variantIndex={variantIndex} taskIndex={activeIndex} disabled={disabled} />
          {!disabled && fields.length > 1 && <div className="flex justify-end">
            <RemoveAction ariaLabel={t("admin.exTask.remove")} onClick={() => removeSharedTask(activeIndex)} />
          </div>}
        </div>}
      </div>
    </section>
  )
}
