"use client"

import { Controller, useWatch, type UseFormReturn } from "react-hook-form"
import { t } from "@/i18n/t"
import { VariantTabs } from "./VariantTabs"
import { TaskAccordion } from "./TaskAccordion"
import { TopologySection } from "./TopologySection"
import * as Popover from "@radix-ui/react-popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { DraftFormValues } from "@/lib/exerciseSchemas"
import { useEditorPosition } from "./EditorPosition"

export function DraftSettings({ form, disabled }: { form: UseFormReturn<DraftFormValues>; disabled: boolean }) {
  return <details className="frost-panel rounded-lg p-5">
    <summary className="cursor-pointer select-none text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      {t("admin.exDraft.settings.title")}
    </summary>
    <div className="mt-3 max-w-xl space-y-3">
      <div>
        <label htmlFor="draft-admin-note" className="text-sm font-medium text-foreground">{t("admin.exDraft.adminNote")}</label>
        <Input id="draft-admin-note" className="mt-1" {...form.register("AdminNote")} disabled={disabled} />
      </div>
      <Controller control={form.control} name="RegenerateFlagsOnPublish" render={({ field }) => <div className="flex items-start gap-2">
        <Checkbox id="regen-flags" ref={field.ref} checked={field.value} onChange={(event) => field.onChange(event.target.checked)} onBlur={field.onBlur} disabled={disabled} />
        <div>
          <label htmlFor="regen-flags" className="text-sm text-foreground">{t("admin.exDraft.regenFlags")}</label>
          <p className="text-xs text-muted-foreground">{t("admin.exDraft.regenFlags.hint")}</p>
        </div>
      </div>} />
    </div>
  </details>
}

export function DraftVariants({
  form,
  disabled,
  onTestVariant,
  canTestVariant = () => false,
}: {
  form: UseFormReturn<DraftFormValues>
  disabled: boolean
  onTestVariant?: (index: number) => void
  canTestVariant?: (index: number) => boolean
}) {
  // Device additions/removals must update the Test action without a page reload.
  useWatch({ control: form.control, name: "Variants" })
  const [section, setSection] = useEditorPosition("section")
  return <section className="frost-panel flex min-h-[min(36rem,calc(100dvh-20rem))] flex-1 flex-col rounded-lg p-5">
    <VariantTabs disabled={disabled} toolbar={(variantIndex) => <>
      <div role="tablist" aria-label={t("admin.exDraft.sections")} className="inline-flex h-9 items-center rounded-md bg-muted p-1">
        {(["tasks", "topology"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={section === value}
          onClick={() => setSection(value)}
          className={`h-7 rounded px-3 text-sm ${section === value ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {t(`admin.exDraft.tab.${value}`)}
        </button>)}
      </div>
      <Popover.Root>
        <Popover.Trigger asChild><Button type="button" variant="outline" size="sm" aria-label={t("admin.exDraft.variantNote")}>{t("admin.exDraft.variantNoteShort")}</Button></Popover.Trigger>
        <Popover.Portal><Popover.Content align="end" sideOffset={6} className="z-[100] w-72 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md">
          <label htmlFor={`variant-note-${variantIndex}`} className="text-sm font-medium">{t("admin.exDraft.variantNote")}</label>
          <Input id={`variant-note-${variantIndex}`} className="mt-2" {...form.register(`Variants.${variantIndex}.Note`)} disabled={disabled} />
        </Popover.Content></Popover.Portal>
      </Popover.Root>
      {!disabled && onTestVariant && canTestVariant(variantIndex) &&
        <Button type="button" variant="outline" size="sm" disabled={!form.getValues(`Variants.${variantIndex}.ID`) || form.formState.isDirty}
          title={!form.getValues(`Variants.${variantIndex}.ID`) || form.formState.isDirty ? t("admin.exDeploy.saveFirst") : undefined}
          onClick={() => onTestVariant(variantIndex)}>{t("admin.exDeploy.test")}</Button>}
    </>} renderVariant={(variantIndex) => <div data-variant-sections data-variant-index={variantIndex} className="min-h-[24rem] pt-3">
      <div role="tabpanel" aria-label={t(`admin.exDraft.tab.${section}`)}>
        {section === "tasks" ? <TaskAccordion variantIndex={variantIndex} disabled={disabled} />
          : <TopologySection variantIndex={variantIndex} disabled={disabled} />}
      </div>
    </div>} />
  </section>
}
