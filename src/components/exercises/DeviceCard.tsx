"use client"

import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus } from "lucide-react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { SelectMenu } from "@/components/ui/select-menu"
import { FieldHelp } from "@/components/ui/field-help"
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form"
import { InterfaceForm } from "./InterfaceForm"
import { SecretInput } from "./SecretInput"
import { ExerciseFieldLabel } from "./ExerciseFieldLabel"
import { RemoveAction } from "./RemoveAction"
import { useEditorPosition } from "./EditorPosition"
import { emptyInterface, type DraftFormValues } from "@/lib/exerciseSchemas"
import type { DeviceType, Protocol, SecurityPreset } from "@/api/exercises/versions"

const DEVICE_TYPES: { value: DeviceType; labelKey: string }[] = [
  { value: "container", labelKey: "admin.exTopo.type.container" },
  { value: "vm", labelKey: "admin.exTopo.type.vm" },
  { value: "unmanaged-switch", labelKey: "admin.exTopo.type.switch" },
  { value: "hub", labelKey: "admin.exTopo.type.hub" },
]

const PROTOCOLS: Protocol[] = ["http", "https"]
const SECURITY_PRESETS: SecurityPreset[] = ["", "basic", "service", "net", "debug"]

/** One device with focused settings; switch/hub expose only basic properties. */
export function DeviceCard({
  variantIndex,
  deviceIndex,
  disabled,
}: {
  variantIndex: number
  deviceIndex: number
  disabled: boolean
}) {
  const { control, getValues, setValue } = useFormContext<DraftFormValues>()
  const base = `Variants.${variantIndex}.Topology.Devices.${deviceIndex}` as const
  const type = useWatch({ control, name: `${base}.Type` })
  const externalEnabled = useWatch({ control, name: `${base}.External.Enabled` })
  const forwarding = type === "unmanaged-switch" || type === "hub"
  type DevicePanel = "basic" | "interfaces" | "env" | "external"
  const [panel, setPanel] = useEditorPosition("devicePanel")
  const visiblePanel = forwarding ? "basic" : panel
  const sections: DevicePanel[] = forwarding ? ["basic"] : ["basic", "interfaces", "env", "external"]

  function onTypeChange(next: string, fieldOnChange: (v: string) => void) {
    fieldOnChange(next)
    if (next === "unmanaged-switch" || next === "hub") {
      // Switch/hub are "bare": clear fields the domain forbids (ErrDeviceTypeInvalid).
      setValue(`${base}.Image`, "")
      setValue(`${base}.Interfaces`, [])
      setValue(`${base}.EnvVars`, [])
      setValue(`${base}.External`, { Enabled: false, Port: 80, Protocol: "http" })
      setValue(`${base}.SecurityPreset`, "")
      setPanel("basic")
    } else if (getValues(`${base}.Interfaces`).length === 0) {
      // Changing a forwarding device back into a compute device must restore
      // its required first interface; external access depends on it.
      setValue(`${base}.Interfaces`, [emptyInterface()], { shouldDirty: true })
    }
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="exercise-device-layout gap-4">
        <nav aria-label={t("admin.exTopo.deviceSettings")} className="flex min-w-0 flex-wrap content-start gap-1 border-b border-border pb-3 xl:flex-col xl:border-b-0 xl:border-r xl:pb-0 xl:pr-3">
          {sections.map((section) => {
            const labelKey = section === "basic" ? "admin.exTopo.basic" : section === "interfaces" ? "admin.exTopo.interfaces" : section === "env" ? "admin.exEnv.title" : "admin.exTopo.external"
            return <button key={section} type="button" aria-current={visiblePanel === section ? "page" : undefined}
              onClick={() => setPanel(section)}
              className={`rounded-md px-2.5 py-2 text-left text-sm ${visiblePanel === section ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {t(labelKey)}
            </button>
          })}
        </nav>
        <div className="min-w-0">
        {visiblePanel === "basic" && <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <FormField control={control} name={`${base}.Name`} render={({ field }) => (
            <FormItem>
              <ExerciseFieldLabel labelKey="admin.exTopo.deviceName" helpKey="admin.exTopo.deviceNameHelp" required form />
              <FormControl><Input {...field} required disabled={disabled} placeholder="web-01" /></FormControl>
              <FormMessage className="min-h-5 leading-5" />
            </FormItem>
          )} />
          <FormField control={control} name={`${base}.Type`} render={({ field }) => (
            <FormItem>
              <ExerciseFieldLabel labelKey="admin.exTopo.deviceType" helpKey="admin.exTopo.deviceTypeHelp" required form />
              <FormControl>
                <SelectMenu
                  value={field.value}
                  onChange={(v) => onTypeChange(v, field.onChange)}
                  disabled={disabled}
                  ariaLabel={t("admin.exTopo.deviceType")}
                  options={DEVICE_TYPES.map((o) => ({ value: o.value, label: t(o.labelKey), description: t(`${o.labelKey}Help`) }))}
                  className="h-10 w-full"
                />
              </FormControl>
              <FormMessage className="min-h-5 leading-5" />
            </FormItem>
          )} />
        {!forwarding && <>
          <FormField control={control} name={`${base}.Image`} render={({ field }) => (
            <FormItem>
              <ExerciseFieldLabel labelKey="admin.exTopo.image" helpKey="admin.exTopo.imageHelp" form />
              <FormControl><Input {...field} disabled={disabled} placeholder="nginx:1.27" /></FormControl>
              <FormMessage className="min-h-5 leading-5" />
            </FormItem>
          )} />
          <FormField control={control} name={`${base}.SecurityPreset`} render={({ field }) => (
            <FormItem>
              <ExerciseFieldLabel labelKey="admin.exTopo.securityPreset" helpKey="admin.exTopo.securityPresetHelp" form />
              <FormControl><SelectMenu value={field.value} onChange={field.onChange} disabled={disabled}
                ariaLabel={t("admin.exTopo.securityPreset")}
                options={SECURITY_PRESETS.map((preset) => ({ value: preset, label: t(`admin.exTopo.security.${preset || "default"}`), description: t(`admin.exTopo.security.${preset || "default"}Help`) }))}
                className="h-10 w-full" /></FormControl>
              <FormMessage className="min-h-5 leading-5" />
            </FormItem>
          )} />
        </>}
        </div>}

        {visiblePanel === "interfaces" &&
          <InterfaceForm variantIndex={variantIndex} deviceIndex={deviceIndex} disabled={disabled} />
        }
        {visiblePanel === "env" &&
          <EnvVarsList variantIndex={variantIndex} deviceIndex={deviceIndex} disabled={disabled} />
        }
        {visiblePanel === "external" && <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5"><h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.external")}</h4><FieldHelp text={t("admin.exTopo.externalHelp")} /></div>
              <Controller
                control={control}
                name={`${base}.External.Enabled`}
                render={({ field }) => (
                  <Switch aria-label={t("admin.exTopo.external")} checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                )}
              />
            </div>
            {externalEnabled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField control={control} name={`${base}.External.Port`} render={({ field }) => (
                  <FormItem>
                    <ExerciseFieldLabel labelKey="admin.exTopo.port" helpKey="admin.exTopo.portHelp" required form />
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={65535}
                        required
                        value={field.value}
                        disabled={disabled}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage className="min-h-5 leading-5" />
                  </FormItem>
                )} />
                <div className="space-y-2">
                  <ExerciseFieldLabel labelKey="admin.exTopo.protocol" helpKey="admin.exTopo.protocolHelp" required />
                  <Controller
                    control={control}
                    name={`${base}.External.Protocol`}
                    render={({ field }) => (
                      <SelectMenu
                        value={field.value}
                        onChange={field.onChange}
                        disabled={disabled}
                        ariaLabel={t("admin.exTopo.protocol")}
                        options={PROTOCOLS.map((p) => ({ value: p, label: p }))}
                        className="h-10 w-full"
                      />
                    )}
                  />
                </div>
              </div>
            )}
          </section>
        }
        </div>
      </div>
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
  const { control, trigger } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Topology.Devices.${deviceIndex}.EnvVars` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const rows = useWatch({ control, name }) ?? []
  const [selectedIndex, setSelectedIndex] = useEditorPosition("env")
  const activeIndex = Math.min(selectedIndex, Math.max(fields.length - 1, 0))

  function addVariable() {
    append({ Name: "", Value: "", Secret: false, HasValue: false })
    setSelectedIndex(fields.length)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5"><h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.exEnv.title")}</h4><FieldHelp text={t("admin.exEnv.titleHelp")} /></div>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addVariable}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exEnv.add")}
          </Button>
        )}
      </div>

      {fields.length > 0 && <div className="flex flex-wrap gap-1 border-b border-border pb-2" role="tablist" aria-label={t("admin.exEnv.title")}>
        {fields.map((field, ei) => <div key={field.id} className={`group inline-flex items-center rounded-md ${activeIndex === ei ? "bg-accent" : ""}`}><button type="button" role="tab" aria-selected={activeIndex === ei}
          onClick={() => setSelectedIndex(ei)}
          className={`rounded-md px-3 py-1.5 text-sm ${activeIndex === ei ? "font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          {rows[ei]?.Name || `${t("admin.exEnv.variable")} ${ei + 1}`}
        </button>{!disabled && <RemoveAction ariaLabel={t("admin.exEnv.remove")} onClick={() => { remove(ei); setSelectedIndex(Math.max(0, ei - 1)) }} className="mr-1 h-7 w-7 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" />}</div>)}
      </div>}

      {fields.map((field, ei) => {
        if (ei !== activeIndex) return null
        const isSecret = rows[ei]?.Secret ?? false
        const hasValue = rows[ei]?.HasValue ?? false
        const value = rows[ei]?.Value ?? ""
        // A stored-but-untouched secret (Secret+HasValue, empty Value) must stay a secret:
        // its plaintext is never available client-side, so un-secretting it would silently
        // downgrade/overwrite the stored value. Lock the checkbox checked until the admin
        // supplies a fresh value via SecretInput's "Replace" (Value !== "").
        const lockSecret = isSecret && hasValue && value === ""
        return (
          <div key={field.id} className="space-y-3 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">{t("admin.exEnv.variable")} {ei + 1}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField control={control} name={`${name}.${ei}.Name`} render={({ field: nameField, fieldState }) => (
              <FormItem>
                <ExerciseFieldLabel labelKey="admin.exEnv.name" helpKey="admin.exEnv.nameHelp" required form />
                <FormControl><Input {...nameField} required disabled={disabled} placeholder="DB_PASS"
                  onChange={(event) => { nameField.onChange(event); if (fieldState.error) void trigger(`${name}.${ei}.Name`) }} /></FormControl>
                <FormMessage className="min-h-5 leading-5" />
              </FormItem>
            )} />
            <div className="space-y-2">
              <ExerciseFieldLabel labelKey="admin.exEnv.value" helpKey="admin.exEnv.valueHelp" />
              <FormField
                control={control}
                name={`${name}.${ei}.Value`}
                render={({ field: valueField }) => <FormItem>
                  <FormControl>{isSecret ? (
                    <SecretInput
                      value={valueField.value}
                      hasValue={hasValue}
                      onChange={valueField.onChange}
                      disabled={disabled}
                    />
                  ) : (
                    <Input value={valueField.value} onChange={valueField.onChange} disabled={disabled} />
                  )}</FormControl>
                  <FormMessage className="min-h-5 leading-5" />
                </FormItem>}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5"><Controller
              control={control}
              name={`${name}.${ei}.Secret`}
              render={({ field: secretField }) => (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    ref={secretField.ref}
                    checked={secretField.value}
                    onChange={(e) => secretField.onChange(e.target.checked)}
                    disabled={disabled || lockSecret}
                  />
                  {t("admin.exEnv.secret")}
                  {lockSecret && (
                    <span className="text-[0.7rem] text-muted-foreground/80">{t("admin.exSecret.lockedHint")}</span>
                  )}
                </label>
              )}
            /><FieldHelp text={t("admin.exEnv.secretHelp")} /></div>
          </div>
          </div>
        )
      })}
    </section>
  )
}
