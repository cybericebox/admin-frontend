"use client"

import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { SelectMenu } from "@/components/ui/select-menu"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { InterfaceForm } from "./InterfaceForm"
import { SecretInput } from "./SecretInput"
import type { DraftFormValues } from "@/lib/exerciseSchemas"
import type { DeviceType, Protocol } from "@/api/exercises/versions"

const DEVICE_TYPES: { value: DeviceType; labelKey: string }[] = [
  { value: "container", labelKey: "admin.exTopo.type.container" },
  { value: "vm", labelKey: "admin.exTopo.type.vm" },
  { value: "unmanaged-switch", labelKey: "admin.exTopo.type.switch" },
  { value: "hub", labelKey: "admin.exTopo.type.hub" },
]

const PROTOCOLS: Protocol[] = ["http", "https"]

/** DeviceCard — a single topology device. Switch/hub show only name+type. */
export function DeviceCard({
  variantIndex,
  deviceIndex,
  disabled,
  onRemove,
}: {
  variantIndex: number
  deviceIndex: number
  disabled: boolean
  onRemove: () => void
}) {
  const { control, setValue } = useFormContext<DraftFormValues>()
  const base = `Variants.${variantIndex}.Topology.Devices.${deviceIndex}` as const
  const type = useWatch({ control, name: `${base}.Type` })
  const externalEnabled = useWatch({ control, name: `${base}.External.Enabled` })
  const forwarding = type === "unmanaged-switch" || type === "hub"

  function onTypeChange(next: string, fieldOnChange: (v: string) => void) {
    fieldOnChange(next)
    if (next === "unmanaged-switch" || next === "hub") {
      // Switch/hub are "bare": clear fields the domain forbids (ErrDeviceTypeInvalid).
      setValue(`${base}.Image`, "")
      setValue(`${base}.Interfaces`, [])
      setValue(`${base}.EnvVars`, [])
      setValue(`${base}.External`, { Enabled: false, Port: 80, Protocol: "http" })
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <FormField control={control} name={`${base}.Name`} render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.exTopo.deviceName")}</FormLabel>
              <FormControl><Input {...field} disabled={disabled} placeholder="web-01" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={control} name={`${base}.Type`} render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.exTopo.deviceType")}</FormLabel>
              <FormControl>
                <SelectMenu
                  value={field.value}
                  onChange={(v) => onTypeChange(v, field.onChange)}
                  disabled={disabled}
                  options={DEVICE_TYPES.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" aria-label={`remove-device-${deviceIndex}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!forwarding && (
        <>
          <FormField control={control} name={`${base}.Image`} render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.exTopo.image")}</FormLabel>
              <FormControl><Input {...field} disabled={disabled} placeholder="nginx:1.27" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <InterfaceForm variantIndex={variantIndex} deviceIndex={deviceIndex} disabled={disabled} />

          <EnvVarsList variantIndex={variantIndex} deviceIndex={deviceIndex} disabled={disabled} />

          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.external")}</span>
              <Controller
                control={control}
                name={`${base}.External.Enabled`}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                )}
              />
            </div>
            {externalEnabled && (
              <div className="grid gap-2 sm:grid-cols-2">
                <FormField control={control} name={`${base}.External.Port`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.exTopo.port")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={65535}
                        value={field.value}
                        disabled={disabled}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exTopo.protocol")}</span>
                  <Controller
                    control={control}
                    name={`${base}.External.Protocol`}
                    render={({ field }) => (
                      <SelectMenu
                        value={field.value}
                        onChange={field.onChange}
                        disabled={disabled}
                        options={PROTOCOLS.map((p) => ({ value: p, label: p }))}
                        className="w-full"
                      />
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** EnvVarsList — container/vm environment variables; secrets go through SecretInput. */
function EnvVarsList({
  variantIndex,
  deviceIndex,
  disabled,
}: {
  variantIndex: number
  deviceIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Topology.Devices.${deviceIndex}.EnvVars` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const rows = useWatch({ control, name }) ?? []

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exEnv.title")}</span>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ Name: "", Value: "", Secret: false, HasValue: false })}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exEnv.add")}
          </Button>
        )}
      </div>

      {fields.map((field, ei) => {
        const isSecret = rows[ei]?.Secret ?? false
        const hasValue = rows[ei]?.HasValue ?? false
        return (
          <div key={field.id} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <FormField control={control} name={`${name}.${ei}.Name`} render={({ field: nameField }) => (
              <FormItem>
                <FormLabel>{t("admin.exEnv.name")}</FormLabel>
                <FormControl><Input {...nameField} disabled={disabled} placeholder="DB_PASS" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exEnv.value")}</span>
              <Controller
                control={control}
                name={`${name}.${ei}.Value`}
                render={({ field: valueField }) =>
                  isSecret ? (
                    <SecretInput
                      value={valueField.value}
                      hasValue={hasValue}
                      onChange={valueField.onChange}
                      disabled={disabled}
                    />
                  ) : (
                    <Input value={valueField.value} onChange={valueField.onChange} disabled={disabled} />
                  )
                }
              />
            </div>
            <Controller
              control={control}
              name={`${name}.${ei}.Secret`}
              render={({ field: secretField }) => (
                <label className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
                  <Checkbox
                    ref={secretField.ref}
                    checked={secretField.value}
                    onChange={(e) => secretField.onChange(e.target.checked)}
                    disabled={disabled}
                  />
                  {t("admin.exEnv.secret")}
                </label>
              )}
            />
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`remove-envvar-${ei}`}
                onClick={() => remove(ei)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
