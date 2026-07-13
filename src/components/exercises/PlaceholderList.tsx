"use client"

import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { SelectMenu } from "@/components/ui/select-menu"
import { emptyPlaceholder, type DraftFormValues } from "@/lib/exerciseSchemas"

const KIND_OPTIONS = [
  { value: "vpn.subnet", labelKey: "admin.exPh.kind.vpnSubnet" },
  { value: "internet.subnet", labelKey: "admin.exPh.kind.internetSubnet" },
  { value: "ip", labelKey: "admin.exPh.kind.ip" },
  { value: "external.link", labelKey: "admin.exPh.kind.externalLink" },
]

const IPREF_OPTIONS = [
  { value: "vpn", labelKey: "admin.exPh.ipref.vpn" },
  { value: "internet", labelKey: "admin.exPh.ipref.internet" },
  { value: "static", labelKey: "admin.exPh.ipref.static" },
]

/**
 * PlaceholderList — structured description placeholders for a task.
 * Row fields depend on Kind; validated against the topology at publish time (backend).
 */
export function PlaceholderList({
  variantIndex,
  taskIndex,
  disabled,
}: {
  variantIndex: number
  taskIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Tasks.${taskIndex}.Placeholders` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const rows = useWatch({ control, name }) ?? []
  const devices = useWatch({ control, name: `Variants.${variantIndex}.Topology.Devices` }) ?? []
  const externalDeviceNames = devices
    .filter((d) => d.External?.Enabled && d.Name)
    .map((d) => d.Name)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exPh.title")}</span>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyPlaceholder())}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exPh.add")}
          </Button>
        )}
      </div>

      {fields.map((field, pi) => {
        const kind = rows[pi]?.Kind
        const ipRef = rows[pi]?.IPReference
        return (
          <div key={field.id} className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exPh.kind")}</span>
                <Controller
                  control={control}
                  name={`${name}.${pi}.Kind`}
                  render={({ field: kindField }) => (
                    <SelectMenu
                      value={kindField.value}
                      onChange={kindField.onChange}
                      disabled={disabled}
                      options={KIND_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                      className="w-full"
                    />
                  )}
                />
              </div>
              {!disabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`remove-placeholder-${pi}`}
                  onClick={() => remove(pi)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {kind === "ip" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exPh.ipref")}</span>
                  <Controller
                    control={control}
                    name={`${name}.${pi}.IPReference`}
                    render={({ field: refField }) => (
                      <SelectMenu
                        value={refField.value}
                        onChange={refField.onChange}
                        disabled={disabled}
                        options={IPREF_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                        className="w-full"
                      />
                    )}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exPh.lastOctet")}</span>
                  <Controller
                    control={control}
                    name={`${name}.${pi}.LastOctet`}
                    render={({ field: octetField }) => (
                      <Input
                        type="number"
                        min={0}
                        max={255}
                        value={octetField.value}
                        disabled={disabled}
                        onChange={(e) => octetField.onChange(Number(e.target.value))}
                      />
                    )}
                  />
                </div>
                {ipRef === "static" && (
                  <div>
                    <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exPh.octets")}</span>
                    <Controller
                      control={control}
                      name={`${name}.${pi}.Octets1to3`}
                      render={({ field: octetsField }) => (
                        <Input placeholder="10.0.0" value={octetsField.value} disabled={disabled}
                          onChange={octetsField.onChange} />
                      )}
                    />
                  </div>
                )}
                <div className="flex items-end gap-2 pb-1">
                  <Controller
                    control={control}
                    name={`${name}.${pi}.ShowMask`}
                    render={({ field: maskField }) => (
                      <Checkbox
                        id={`ph-mask-${variantIndex}-${taskIndex}-${pi}`}
                        ref={maskField.ref}
                        checked={maskField.value}
                        onChange={(e) => maskField.onChange(e.target.checked)}
                        onBlur={maskField.onBlur}
                        disabled={disabled}
                        label={t("admin.exPh.showMask")}
                      />
                    )}
                  />
                </div>
              </div>
            )}

            {kind === "external.link" && (
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exPh.device")}</span>
                <Controller
                  control={control}
                  name={`${name}.${pi}.DeviceName`}
                  render={({ field: devField }) => (
                    <SelectMenu
                      value={devField.value}
                      onChange={devField.onChange}
                      disabled={disabled}
                      placeholder={t("admin.exPh.device.placeholder")}
                      options={externalDeviceNames.map((n) => ({ value: n, label: n }))}
                      className="w-full"
                    />
                  )}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
