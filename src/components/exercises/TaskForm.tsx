"use client"

import { Controller, useFormContext, useWatch } from "react-hook-form"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { SelectMenu } from "@/components/ui/select-menu"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import RichTextEditor from "@/components/notifications/editor/RichTextEditor"
import { AttachmentList } from "./AttachmentList"
import { FlagInput } from "./FlagInput"
import { PlaceholderList } from "./PlaceholderList"
import type { DraftFormValues } from "@/lib/exerciseSchemas"

const DIFFICULTIES = ["trivial", "easy", "medium", "hard", "insane"] as const

/** TaskForm — the fields of a single variant task (inside the accordion). */
export function TaskForm({
  variantIndex,
  taskIndex,
  disabled,
}: {
  variantIndex: number
  taskIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const base = `Variants.${variantIndex}.Tasks.${taskIndex}` as const
  // Flag device linking — only devices from THIS variant's topology.
  const devices = useWatch({ control, name: `Variants.${variantIndex}.Topology.Devices` }) ?? []
  const linkable = devices.filter((d) => d.Type === "container" || d.Type === "vm")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Name grows; Difficulty is a small enum — size it to content, not half the row. */}
        <FormField control={control} name={`${base}.Name`} render={({ field }) => (
          <FormItem className="min-w-56 max-w-md flex-1">
            <FormLabel>{t("admin.exTask.name")}</FormLabel>
            <FormControl><Input {...field} disabled={disabled} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name={`${base}.Difficulty`} render={({ field }) => (
          <FormItem className="w-40">
            <FormLabel>{t("admin.exTask.difficulty")}</FormLabel>
            <FormControl>
              <SelectMenu
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                options={DIFFICULTIES.map((d) => ({ value: d, label: t(`admin.ex.difficulty.${d}`) }))}
                className="w-full"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <div>
        <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
          {t("admin.exTask.description")}
        </span>
        {/* Lexical is the one controlled exception: JSON state lives in the form field via Controller. */}
        <Controller
          control={control}
          name={`${base}.Description`}
          render={({ field }) => (
            <RichTextEditor value={field.value} onChange={field.onChange} disabled={disabled} />
          )}
        />
      </div>

      <Controller
        control={control}
        name={`${base}.Flag`}
        render={({ field }) => (
          <FlagInput value={field.value} onChange={field.onChange} disabled={disabled} />
        )}
      />

      <div className="flex flex-wrap items-end gap-3">
        {/* Flag device (grows) + the env var name it lands in (short — sized to content). */}
        <FormField control={control} name={`${base}.LinkedDeviceID`} render={({ field }) => (
          <FormItem className="min-w-56 flex-1">
            <FormLabel>{t("admin.exTask.linkedDevice")}</FormLabel>
            <FormControl>
              <SelectMenu
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                options={[
                  { value: "", label: t("admin.exTask.linkedDevice.none") },
                  ...linkable.map((d) => ({ value: d.ID, label: d.Name || d.ID.slice(0, 8) })),
                ]}
                className="w-full"
              />
            </FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${base}.DeviceFlagVar`} render={({ field }) => (
          <FormItem className="w-56">
            <FormLabel>{t("admin.exTask.deviceFlagVar")}</FormLabel>
            <FormControl><Input {...field} disabled={disabled} placeholder="FLAG" /></FormControl>
          </FormItem>
        )} />
      </div>

      <AttachmentList variantIndex={variantIndex} taskIndex={taskIndex} disabled={disabled} />

      <PlaceholderList variantIndex={variantIndex} taskIndex={taskIndex} disabled={disabled} />
    </div>
  )
}
