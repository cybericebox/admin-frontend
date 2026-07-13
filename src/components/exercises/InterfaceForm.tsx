"use client"

import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { emptyInterface, type DraftFormValues } from "@/lib/exerciseSchemas"

const IP_TYPES = [
  { value: "static", labelKey: "admin.exTopo.ip.static" },
  { value: "dhcp", labelKey: "admin.exTopo.ip.dhcp" },
  { value: "none", labelKey: "admin.exTopo.ip.none" },
]

/** List of CIDR addresses on an interface (static IP config only). */
function AddressList({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (v: string[]) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t("admin.exTopo.addresses")}</span>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])}>
            <Plus className="mr-1 h-3 w-3" />
            {t("admin.exTopo.addAddress")}
          </Button>
        )}
      </div>
      {value.map((addr, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={addr}
            placeholder="10.0.0.2/24"
            disabled={disabled}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
          />
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`remove-address-${i}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}

/** InterfaceForm — a container/vm device's interfaces: name, MAC, IP config. */
export function InterfaceForm({
  variantIndex,
  deviceIndex,
  disabled,
}: {
  variantIndex: number
  deviceIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Topology.Devices.${deviceIndex}.Interfaces` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const rows = useWatch({ control, name }) ?? []

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.interfaces")}</span>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyInterface())}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTopo.addInterface")}
          </Button>
        )}
      </div>

      {fields.map((field, ii) => {
        const ipType = rows[ii]?.IP?.Type
        return (
          <div key={field.id} className="space-y-2 rounded-md border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <FormField control={control} name={`${name}.${ii}.Name`} render={({ field: nameField }) => (
                <FormItem>
                  <FormLabel>{t("admin.exTopo.ifaceName")}</FormLabel>
                  <FormControl><Input {...nameField} disabled={disabled} placeholder="eth0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={control} name={`${name}.${ii}.MAC`} render={({ field: macField }) => (
                <FormItem>
                  <FormLabel>{t("admin.exTopo.mac")}</FormLabel>
                  <FormControl>
                    <Input {...macField} disabled={disabled} placeholder="02:42:ac:11:00:02" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exTopo.ipType")}</span>
                <Controller
                  control={control}
                  name={`${name}.${ii}.IP.Type`}
                  render={({ field: typeField }) => (
                    <SelectMenu
                      value={typeField.value}
                      onChange={typeField.onChange}
                      disabled={disabled}
                      options={IP_TYPES.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                      className="w-full"
                    />
                  )}
                />
              </div>
            </div>

            {ipType === "static" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Controller
                  control={control}
                  name={`${name}.${ii}.IP.Addresses`}
                  render={({ field: addrField, fieldState }) => (
                    <div>
                      <AddressList value={addrField.value} onChange={addrField.onChange} disabled={disabled} />
                      {fieldState.error && (
                        <p className="text-[0.8rem] font-medium text-destructive">
                          {fieldState.error.message ?? fieldState.error.root?.message}
                        </p>
                      )}
                    </div>
                  )}
                />
                <FormField control={control} name={`${name}.${ii}.IP.Gateway`} render={({ field: gwField }) => (
                  <FormItem>
                    <FormLabel>{t("admin.exTopo.gateway")}</FormLabel>
                    <FormControl><Input {...gwField} disabled={disabled} placeholder="10.0.0.1" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`remove-interface-${ii}`}
                onClick={() => remove(ii)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {t("admin.exTopo.removeInterface")}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
