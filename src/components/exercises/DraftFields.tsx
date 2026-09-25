"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { ChevronDown } from "lucide-react"
import { t } from "@/i18n/t"
import { VariantTabs } from "./VariantTabs"
import { TaskAccordion } from "./TaskAccordion"
import { TopologySection } from "./TopologySection"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldHelp } from "@/components/ui/field-help"
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
  const [section, setSection] = useEditorPosition("section")
  return <section data-testid="draft-variants" className="flex min-h-[min(36rem,calc(100dvh-20rem))] min-w-0 flex-1 flex-col">
    <VariantTabs disabled={disabled} toolbar={(variantIndex) => <>
      <div role="tablist" aria-label={t("admin.exDraft.sections")} className="inline-flex h-9 items-center rounded-md bg-muted p-1">
        {(["tasks", "topology"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={section === value}
          onClick={() => setSection(value)}
          className={`h-7 rounded px-3 text-sm ${section === value ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {t(`admin.exDraft.tab.${value}`)}
        </button>)}
      </div>
      {!disabled && onTestVariant && canTestVariant(variantIndex) &&
        <Button type="button" variant="outline" size="sm" disabled={!form.getValues(`Variants.${variantIndex}.ID`) || form.formState.isDirty}
          title={!form.getValues(`Variants.${variantIndex}.ID`) || form.formState.isDirty ? t("admin.exDeploy.saveFirst") : undefined}
          onClick={() => onTestVariant(variantIndex)}>{t("admin.exDeploy.test")}</Button>}
    </>} renderVariant={(variantIndex) => <div data-variant-sections data-variant-index={variantIndex} className="min-h-[24rem] pt-2">
      <details key={variantIndex} className="group/notes mb-3 border-b border-border pb-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-1.5 leading-5">
            <span className="text-sm font-medium leading-5">{t("admin.exDraft.variantNoteShort")}</span>
            <span className="flex h-5 items-center" onClick={(event) => event.stopPropagation()}><FieldHelp text={t("admin.exDraft.variantNoteHelp")} /></span>
          </span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/notes:rotate-180" />
        </summary>
        <div className="pt-2">
          <label htmlFor={`variant-note-${variantIndex}`} className="sr-only">{t("admin.exDraft.variantNote")}</label>
          <Textarea id={`variant-note-${variantIndex}`} rows={5} className="max-h-40 overflow-y-auto resize-y" {...form.register(`Variants.${variantIndex}.Note`)} disabled={disabled} />
        </div>
      </details>
      <div role="tabpanel" aria-label={t(`admin.exDraft.tab.${section}`)}>
        {section === "tasks" ? <TaskAccordion variantIndex={variantIndex} disabled={disabled} />
          : <TopologySection variantIndex={variantIndex} disabled={disabled} />}
      </div>
    </div>} />
  </section>
}
