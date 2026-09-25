"use client"

import { useFieldArray, useFormContext } from "react-hook-form"
import { Plus } from "lucide-react"
import { t } from "@/i18n/t"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { emptyTask, emptyVariant, type DraftFormValues } from "@/lib/exerciseSchemas"
import { RemoveAction } from "./RemoveAction"
import { useEditorPosition } from "./EditorPosition"

/**
 * VariantTabs — variant tabs on top of useFieldArray("Variants").
 * The tab header is a decorative number (position + 1); variant identity is ID.
 */
export function VariantTabs({
  disabled,
  renderVariant,
  toolbar,
}: {
  disabled: boolean
  renderVariant: (variantIndex: number) => React.ReactNode
  toolbar?: (variantIndex: number) => React.ReactNode
}) {
  const { control, getValues } = useFormContext<DraftFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: "Variants" })
  const [selected, setSelected] = useEditorPosition("variant")
  const active = Math.min(selected, Math.max(fields.length - 1, 0))

  function addVariant() {
    const variant = emptyVariant(fields.length + 1)
    // Task positions/IDs/difficulty are shared across variants. Content and
    // secrets are not: an alternate needs its own description and flags.
    variant.Tasks = getValues("Variants.0.Tasks").map((task) => ({
      ...emptyTask(), ID: task.ID, Name: task.Name, Difficulty: task.Difficulty,
    }))
    append(variant)
    setSelected(fields.length)
  }

  function removeActiveVariant() {
    remove(active)
    setSelected(0)
  }

  return (
    <Tabs value={String(active)} onValueChange={(value) => setSelected(Number(value))} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <TabsList>
          {fields.map((field, i) => (
            <TabsTrigger key={field.id} value={String(i)}>
              {t("admin.exDraft.variant")} {i + 1}
            </TabsTrigger>
          ))}
        </TabsList>
        {!disabled && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={addVariant}>
              <Plus className="mr-1 h-4 w-4" />
              {t("admin.exDraft.addVariant")}
            </Button>
            {fields.length > 1 && (
              <RemoveAction ariaLabel={t("admin.exDraft.removeVariant")} onClick={removeActiveVariant} />
            )}
          </>
        )}
        {toolbar && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{toolbar(active)}</div>}
      </div>
      {fields.map((field, i) => (
        <TabsContent key={field.id} value={String(i)} className="flex-1">
          {renderVariant(i)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
