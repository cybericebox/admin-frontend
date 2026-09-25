"use client"

import { Controller, useFormContext, useWatch } from "react-hook-form"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { SelectMenu } from "@/components/ui/select-menu"
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form"
import RichTextEditor from "@/components/notifications/editor/RichTextEditor"
import { AttachmentList } from "./AttachmentList"
import { FlagInput } from "./FlagInput"
import { PlaceholderList } from "./PlaceholderList"
import { ExerciseFieldLabel } from "./ExerciseFieldLabel"
import type { DraftFormValues } from "@/lib/exerciseSchemas"
import type { Difficulty } from "@/api/exercises/versions"

const DIFFICULTIES = ["trivial", "easy", "medium", "hard", "insane"] as const

/** TaskForm — the fields of one selected task in a variant. */
export function TaskForm({
  variantIndex,
  taskIndex,
  disabled,
}: {
  variantIndex: number
  taskIndex: number
  disabled: boolean
}) {
  const { control, getValues, setValue } = useFormContext<DraftFormValues>()
  const base = `Variants.${variantIndex}.Tasks.${taskIndex}` as const
  // Flag device linking — only devices from THIS variant's topology.
  const devices = useWatch({ control, name: `Variants.${variantIndex}.Topology.Devices` }) ?? []
  const linkable = devices.filter((d) => d.Type === "container" || d.Type === "vm")
  const linkedDeviceID = useWatch({ control, name: `${base}.LinkedDeviceID` })

  return (
    <div className="space-y-4">
      <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Name grows; Difficulty is a small enum — size it to content, not half the row. */}
        <FormField control={control} name={`${base}.Name`} render={({ field }) => (
          <FormItem className="min-w-56 flex-1">
            <ExerciseFieldLabel labelKey="admin.exTask.name" helpKey="admin.exTask.nameHelp" required form />
            <FormControl><Input {...field} required disabled={disabled} /></FormControl>
            <FormMessage className="min-h-5 leading-5" />
          </FormItem>
        )} />
        <FormField control={control} name={`${base}.Difficulty`} render={({ field }) => (
          <FormItem className="w-40">
            <ExerciseFieldLabel labelKey="admin.exTask.difficulty" helpKey="admin.exTask.difficultyHelp" required form />
            <FormControl>
              <SelectMenu
                value={field.value}
                onChange={(difficulty) => {
                  field.onChange(difficulty)
                  getValues("Variants").forEach((_, index) => {
                    if (index !== variantIndex) {
                      setValue(`Variants.${index}.Tasks.${taskIndex}.Difficulty`, difficulty as Difficulty, { shouldDirty: true })
                    }
                  })
                }}
                disabled={disabled}
                options={DIFFICULTIES.map((d) => ({ value: d, label: t(`admin.ex.difficulty.${d}`) }))}
                className="w-full"
              />
            </FormControl>
            <FormMessage className="min-h-5 leading-5" />
          </FormItem>
        )} />
      </div>

      <div>
        <ExerciseFieldLabel labelKey="admin.exTask.description" helpKey="admin.exTask.descriptionHelp" />
        {/* Lexical is the one controlled exception: JSON state lives in the form field via Controller. */}
        <Controller
          control={control}
          name={`${base}.Description`}
          render={({ field }) => (
            <RichTextEditor value={field.value} onChange={field.onChange} disabled={disabled} />
          )}
        />
      </div>
      </section>

      <section className="border-t border-border pt-4">
      <Controller
        control={control}
        name={`${base}.Flag`}
        render={({ field, fieldState }) => (
          <FlagInput
            value={field.value}
            onChange={field.onChange}
            disabled={disabled}
            errors={Array.isArray(fieldState.error) ? fieldState.error.map((item) => item?.message) : []}
          />
        )}
      />
      </section>

      {(linkable.length > 0 || linkedDeviceID) && <section className="space-y-3 border-t border-border pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.exTask.flagDelivery")}</h4>
        <div className="flex flex-wrap items-end gap-3">
        <FormField control={control} name={`${base}.LinkedDeviceID`} render={({ field }) => (
          <FormItem className="w-full max-w-md flex-1">
            <ExerciseFieldLabel labelKey="admin.exTask.linkedDevice" helpKey="admin.exTask.linkedDeviceHelp" form />
            <FormControl>
              <SelectMenu
                value={field.value}
                onChange={(value) => {
                  field.onChange(value)
                  if (!value) setValue(`${base}.DeviceFlagVar`, "", { shouldDirty: true })
                }}
                disabled={disabled}
                options={[
                  { value: "", label: t("admin.exTask.linkedDevice.none") },
                  ...linkable.map((d) => ({ value: d.ID, label: d.Name || d.ID.slice(0, 8) })),
                ]}
                className="w-full"
              />
            </FormControl>
            <FormMessage className="min-h-5 leading-5" />
          </FormItem>
        )} />
        {linkedDeviceID && <FormField control={control} name={`${base}.DeviceFlagVar`} render={({ field }) => (
          <FormItem className="w-full max-w-xs flex-1">
            <ExerciseFieldLabel labelKey="admin.exTask.deviceFlagVar" helpKey="admin.exTask.deviceFlagVarHelp" required form />
            <FormControl><Input {...field} disabled={disabled} placeholder="FLAG" /></FormControl>
            <FormMessage className="min-h-5 leading-5" />
          </FormItem>
        )} />}
        </div>
      </section>}

      <div className="grid gap-5 border-t border-border pt-4 xl:grid-cols-2">
        <AttachmentList variantIndex={variantIndex} taskIndex={taskIndex} disabled={disabled} />
        <PlaceholderList variantIndex={variantIndex} taskIndex={taskIndex} disabled={disabled} />
      </div>
    </div>
  )
}
