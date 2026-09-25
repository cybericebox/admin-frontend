"use client"

import { Controller, useFieldArray, useFormContext, useFormState, useWatch } from "react-hook-form"
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

function StaticRouteCard({ routesName, index, disabled, compact, onRemove }: {
  routesName: `Variants.${number}.Topology.Devices.${number}.Interfaces.${number}.IP.Routes`
  index: number
  disabled: boolean
  compact: boolean
  onRemove: () => void
}) {
  const { control, getFieldState } = useFormContext<DraftFormValues>()
  const destinationName = `${routesName}.${index}.Dst` as const
  const viaName = `${routesName}.${index}.Via` as const
  const formState = useFormState({ control, name: [destinationName, viaName] })
  const destinationError = getFieldState(destinationName, formState).error?.message
  const viaError = getFieldState(viaName, formState).error?.message

  return <div data-route-card className="space-y-1 rounded-md border border-border p-2">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-muted-foreground">{t("admin.exTopo.routeItem")} {index + 1}</span>
      {!disabled && <RemoveAction ariaLabel={t("admin.exTopo.removeRoute")} onClick={onRemove} className="h-7 w-7" />}
    </div>
    <div data-route-fields className={`grid ${compact ? "grid-cols-1 gap-1" : "gap-2 sm:grid-cols-2"}`}>
      <FormField control={control} name={destinationName} render={({ field }) => <FormItem className="space-y-1">
        <ExerciseFieldLabel labelKey="admin.exTopo.routeDst" helpKey="admin.exTopo.routeDstHelp" required form />
        <FormControl><Input {...field} className={compact ? "h-9" : undefined} disabled={disabled} placeholder="10.1.0.0/16" /></FormControl>
      </FormItem>} />
      <FormField control={control} name={viaName} render={({ field }) => <FormItem className="space-y-1">
        <ExerciseFieldLabel labelKey="admin.exTopo.routeVia" helpKey="admin.exTopo.routeViaHelp" required form />
        <FormControl><Input {...field} className={compact ? "h-9" : undefined} disabled={disabled} placeholder="10.0.0.1" /></FormControl>
      </FormItem>} />
    </div>
    <div data-error-slot className="min-h-4 text-[0.8rem] font-medium leading-4 text-destructive" aria-live="polite">
      {destinationError && <p>{t("admin.exTopo.routeDst")}: {destinationError}</p>}
      {viaError && <p>{t("admin.exTopo.routeVia")}: {viaError}</p>}
    </div>
  </div>
}

/** One static address and optional explicit routes for a single interface. */
function StaticIPFields({ name, disabled, compact }: {
  name: `Variants.${number}.Topology.Devices.${number}.Interfaces.${number}`
  disabled: boolean
  compact: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const routesName = `${name}.IP.Routes` as const
  const { fields, append, remove } = useFieldArray({ control, name: routesName })
  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div className={`grid ${compact ? "grid-cols-1 gap-2" : "gap-3 sm:grid-cols-2"}`}>
        <FormField control={control} name={`${name}.IP.Addresses`} render={({ field, fieldState }) => (
          <FormItem className={compact ? "space-y-1" : undefined}>
            <ExerciseFieldLabel labelKey="admin.exTopo.addresses" helpKey="admin.exTopo.addressesHelp" required form />
            <FormControl><Input value={field.value[0] ?? ""} onChange={(event) => field.onChange([event.target.value])} disabled={disabled} placeholder="10.0.0.2/24" /></FormControl>
            {(fieldState.error || !compact) && <p className={compact ? "text-[0.8rem] font-medium leading-5 text-destructive" : "min-h-5 text-[0.8rem] font-medium leading-5 text-destructive"}>{fieldState.error?.message ?? fieldState.error?.root?.message}</p>}
          </FormItem>
        )} />
        <FormField control={control} name={`${name}.IP.Gateway`} render={({ field, fieldState }) => (
          <FormItem className={compact ? "space-y-1" : undefined}>
            <ExerciseFieldLabel labelKey="admin.exTopo.gateway" helpKey="admin.exTopo.gatewayHelp" form />
            <FormControl><Input {...field} disabled={disabled} placeholder="10.0.0.1" /></FormControl>
            {(fieldState.error || !compact) && <FormMessage className={compact ? "leading-5" : "min-h-5 leading-5"} />}
          </FormItem>
        )} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5"><span className="text-sm font-medium">{t("admin.exTopo.routes")}</span><FieldHelp text={t("admin.exTopo.routesHelp")} /></div>
          {!disabled && <Button type="button" variant="outline" size="sm" onClick={() => append({ Dst: "", Via: "" })}><Plus className="mr-1 h-4 w-4" />{t("admin.exTopo.addRoute")}</Button>}
        </div>
        {fields.map((route, index) => <StaticRouteCard key={route.id} routesName={routesName} index={index} disabled={disabled} compact={compact} onRemove={() => remove(index)} />)}
      </div>
    </div>
  )
}

/** InterfaceForm — a container's interfaces: name, MAC, IP config. */
export function InterfaceForm({
  variantIndex,
  deviceIndex,
  disabled,
  compact = false,
}: {
  variantIndex: number
  deviceIndex: number
  disabled: boolean
  compact?: boolean
}) {
  const { control, setValue } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Topology.Devices.${deviceIndex}.Interfaces` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const rows = useWatch({ control, name }) ?? []
  const [selectedIndex, setSelectedIndex] = useEditorPosition("interface")
  const activeIndex = Math.min(selectedIndex, Math.max(fields.length - 1, 0))

  function addInterface() {
    const used = new Set(rows.map((row) => row.Name.trim()))
    let next = 0
    while (used.has(`eth${next}`)) next++
    append({ ...emptyInterface(), Name: `eth${next}` })
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

      {fields.length > 1 && <div className="flex min-w-0 flex-nowrap gap-1 overflow-x-auto border-b border-border pb-2" role="tablist" aria-label={t("admin.exTopo.interfaces")}>
        {fields.map((field, ii) => <div key={field.id} className={`group inline-flex shrink-0 items-center rounded-md ${activeIndex === ii ? "bg-accent" : ""}`}><button type="button" role="tab" aria-selected={activeIndex === ii}
          onClick={() => setSelectedIndex(ii)}
          className={`rounded-md px-3 py-1.5 text-sm ${activeIndex === ii ? "font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          {rows[ii]?.Name || `${t("admin.exTopo.interfaceItem")} ${ii + 1}`}
        </button>{!disabled && <RemoveAction ariaLabel={t("admin.exTopo.removeInterface")} onClick={() => { remove(ii); setSelectedIndex(Math.max(0, ii - 1)) }} className="mr-1 h-7 w-7 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" />}</div>)}
      </div>}

      {fields.map((field, ii) => {
        if (ii !== activeIndex) return null
        const ipType = rows[ii]?.IP?.Type
        return (
          <div key={field.id} data-interface-panel className={compact ? "space-y-2 pt-2" : "space-y-3 border-t border-border pt-3"}>
            {!compact && <p className="text-xs font-medium text-muted-foreground">{t("admin.exTopo.interfaces")} {ii + 1}</p>}
            <div data-interface-grid className={`grid ${compact ? "grid-cols-1 gap-2" : "gap-3 sm:grid-cols-2 lg:grid-cols-3"}`}>
              <FormField control={control} name={`${name}.${ii}.Name`} render={({ field: nameField, fieldState }) => (
                <FormItem className={compact ? "space-y-1" : undefined}>
                  <ExerciseFieldLabel labelKey="admin.exTopo.ifaceName" helpKey="admin.exTopo.ifaceNameHelp" required form />
                  <FormControl><Input {...nameField} required disabled={disabled} placeholder="eth0" /></FormControl>
                  {(fieldState.error || !compact) && <FormMessage className={compact ? "leading-5" : "min-h-5 leading-5"} />}
                </FormItem>
              )} />
              <FormField control={control} name={`${name}.${ii}.MAC`} render={({ field: macField, fieldState }) => (
                <FormItem className={compact ? "space-y-1" : undefined}>
                  <ExerciseFieldLabel labelKey="admin.exTopo.mac" helpKey="admin.exTopo.macHelp" form />
                  <FormControl>
                    <Input {...macField} disabled={disabled} placeholder="02:42:ac:11:00:02" />
                  </FormControl>
                  {(fieldState.error || !compact) && <FormMessage className={compact ? "leading-5" : "min-h-5 leading-5"} />}
                </FormItem>
              )} />
              <div className={compact ? "space-y-1" : "space-y-2"}>
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
                          setValue(`${name}.${ii}.IP.Routes`, [], { shouldDirty: true })
                        } else if (rows[ii]?.IP?.Addresses.length === 0) {
                          setValue(`${name}.${ii}.IP.Addresses`, [""], { shouldDirty: true })
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

            {ipType === "static" && <StaticIPFields name={`${name}.${ii}`} disabled={disabled} compact={compact} />}

          </div>
        )
      })}
    </div>
  )
}
