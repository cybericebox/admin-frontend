"use client"

import { useState } from "react"
import { useFieldArray, useFormContext } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { emptyVariant, type DraftFormValues } from "@/lib/exerciseSchemas"

/**
 * VariantTabs — variant tabs on top of useFieldArray("Variants").
 * The tab header is a decorative number (position + 1); variant identity is ID.
 */
export function VariantTabs({
  disabled,
  renderVariant,
}: {
  disabled: boolean
  renderVariant: (variantIndex: number) => React.ReactNode
}) {
  const { control } = useFormContext<DraftFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: "Variants" })
  const [active, setActive] = useState("0")

  function addVariant() {
    append(emptyVariant(fields.length + 1))
    setActive(String(fields.length))
  }

  function removeActiveVariant() {
    remove(Number(active))
    setActive("0")
  }

  return (
    <Tabs value={active} onValueChange={setActive}>
      <div className="flex flex-wrap items-center gap-2">
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
              <Button type="button" variant="outline" size="sm" onClick={removeActiveVariant}>
                <Trash2 className="mr-1 h-4 w-4" />
                {t("admin.exDraft.removeVariant")}
              </Button>
            )}
          </>
        )}
      </div>
      {fields.map((field, i) => (
        <TabsContent key={field.id} value={String(i)}>
          {renderVariant(i)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
