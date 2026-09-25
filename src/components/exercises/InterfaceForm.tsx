"use client"

import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus } from "lucide-react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form"
import { emptyInterface, type DraftFormValues } from "@/lib/exerciseSchemas"
import { ExerciseFieldLabel } from "./ExerciseFieldLabel"
import { RemoveAction } from "./RemoveAction"
import { FieldHelp } from "@/components/ui/field-help"
import { useEditorPosition } from "./EditorPosition"

const IP_TYPES = [
  { value: "static", labelKey: "admin.exTopo.ip.static" },
  { value: "dhcp", labelKey: "admin.exTopo.ip.dhcp" },
  { value: "dhcp-preset", labelKey: "admin.exTopo.ip.dhcpPreset" },
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
        <ExerciseFieldLabel labelKey="admin.exTopo.addresses" helpKey="admin.exTopo.addressesHelp" required />
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
          {!disabled && <RemoveAction ariaLabel={t("admin.exTopo.removeAddress")} onClick={() => onChange(value.filter((_, j) => j !== i))} />}
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
  const { control, setValue } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Topology.Devices.${deviceIndex}.Interfaces` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const rows = useWatch({ control, name }) ?? []
  const [selectedIndex, setSelectedIndex] = useEditorPosition("interface")
  const activeIndex = Math.min(selectedIndex, Math.max(fields.length - 1, 0))

  function addInterface() {
    append(emptyInterface())
    setSelectedIndex(fields.length)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5"><h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.interfaces")}</h4><FieldHelp text={t("admin.exTopo.interfacesHelp")} /></div>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addInterface}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTopo.addInterface")}
          </Button>
        )}
      </div>

      {fields.length > 1 && <div className="flex flex-wrap gap-1 border-b border-border pb-2" role="tablist" aria-label={t("admin.exTopo.interfaces")}>
        {fields.map((field, ii) => <div key={field.id} className={`group inline-flex items-center rounded-md ${activeIndex === ii ? "bg-accent" : ""}`}><button type="button" role="tab" aria-selected={activeIndex === ii}
          onClick={() => setSelectedIndex(ii)}
          className={`rounded-md px-3 py-1.5 text-sm ${activeIndex === ii ? "font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          {rows[ii]?.Name || `${t("admin.exTopo.interfaceItem")} ${ii + 1}`}
        </button>{!disabled && <RemoveAction ariaLabel={t("admin.exTopo.removeInterface")} onClick={() => { remove(ii); setSelectedIndex(Math.max(0, ii - 1)) }} className="mr-1 h-7 w-7 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" />}</div>)}
      </div>}

      {fields.map((field, ii) => {
        if (ii !== activeIndex) return null
        const ipType = rows[ii]?.IP?.Type
        return (
          <div key={field.id} className="space-y-3 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">{t("admin.exTopo.interfaces")} {ii + 1}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField control={control} name={`${name}.${ii}.Name`} render={({ field: nameField }) => (
                <FormItem>
                  <ExerciseFieldLabel labelKey="admin.exTopo.ifaceName" helpKey="admin.exTopo.ifaceNameHelp" required form />
                  <FormControl><Input {...nameField} required disabled={disabled} placeholder="eth0" /></FormControl>
                  <FormMessage className="min-h-5 leading-5" />
                </FormItem>
              )} />
              <FormField control={control} name={`${name}.${ii}.MAC`} render={({ field: macField }) => (
                <FormItem>
                  <ExerciseFieldLabel labelKey="admin.exTopo.mac" helpKey="admin.exTopo.macHelp" form />
                  <FormControl>
                    <Input {...macField} disabled={disabled} placeholder="02:42:ac:11:00:02" />
                  </FormControl>
                  <FormMessage className="min-h-5 leading-5" />
                </FormItem>
              )} />
              <div className="space-y-2">
                <ExerciseFieldLabel labelKey="admin.exTopo.ipType" helpKey="admin.exTopo.ipTypeHelp" required />
                <Controller
                  control={control}
                  name={`${name}.${ii}.IP.Type`}
                  render={({ field: typeField }) => (
                    <SelectMenu
                      value={typeField.value}
                      onChange={(value) => {
                        typeField.onChange(value)
                        if (value !== "static") {
                          setValue(`${name}.${ii}.IP.Addresses`, [], { shouldDirty: true })
                          setValue(`${name}.${ii}.IP.Gateway`, "", { shouldDirty: true })
                        }
                      }}
                      disabled={disabled}
                      ariaLabel={t("admin.exTopo.ipType")}
                      options={IP_TYPES.map((o) => ({ value: o.value, label: t(o.labelKey), description: t(`${o.labelKey}Help`) }))}
                      className="h-10 w-full"
                    />
                  )}
                />
              </div>
            </div>

            {ipType === "static" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Controller
                  control={control}
                  name={`${name}.${ii}.IP.Addresses`}
                  render={({ field: addrField, fieldState }) => (
                    <div>
                      <AddressList value={addrField.value} onChange={addrField.onChange} disabled={disabled} />
                      <p className="min-h-5 text-[0.8rem] font-medium leading-5 text-destructive">
                        {fieldState.error?.message ?? fieldState.error?.root?.message}
                      </p>
                    </div>
                  )}
                />
                <FormField control={control} name={`${name}.${ii}.IP.Gateway`} render={({ field: gwField }) => (
                  <FormItem>
                    <ExerciseFieldLabel labelKey="admin.exTopo.gateway" helpKey="admin.exTopo.gatewayHelp" form />
                    <FormControl><Input {...gwField} disabled={disabled} placeholder="10.0.0.1" /></FormControl>
                    <FormMessage className="min-h-5 leading-5" />
                  </FormItem>
                )} />
              </div>
            )}

          </div>
        )
      })}
    </div>
  )
}
