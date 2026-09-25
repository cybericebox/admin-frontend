"use client"

import { useState } from "react"
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import { EmptyState } from "@/components/ui/empty-state"
import type { NormalizedEndpoint } from "@/api/exercises/versions"
import type { DraftFormValues } from "@/lib/exerciseSchemas"
import { RemoveAction } from "./RemoveAction"
import { FieldHelp } from "@/components/ui/field-help"

/** Encode one connection endpoint into a select value: vpn | internet | device:<id>:<iface>. */
export function encodeEndpoint(ep: NormalizedEndpoint): string {
  if (ep.Kind === "device") return `device:${ep.DeviceID}:${ep.Interface}`
  return ep.Kind
}

export function decodeEndpoint(value: string): NormalizedEndpoint {
  if (value === "vpn" || value === "internet") {
    return { Kind: value, DeviceID: "", Interface: "" }
  }
  const rest = value.slice("device:".length)
  const sep = rest.indexOf(":")
  return { Kind: "device", DeviceID: rest.slice(0, sep), Interface: rest.slice(sep + 1) }
}

/**
 * ConnectionList — pairs of endpoints ("device/interface" | VPN | Internet).
 * Devices are addressed by ID (new devices already have a client-side uuid);
 * a switch/hub endpoint has no interface (domain rule).
 */
export function ConnectionList({
  variantIndex,
  disabled,
  pendingPair,
  onCanvasConnected,
}: {
  variantIndex: number
  disabled: boolean
  pendingPair?: [string, string] | null
  onCanvasConnected?: () => void
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Topology.Connections` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const connections = useWatch({ control, name }) ?? []
  const devices = useWatch({ control, name: `Variants.${variantIndex}.Topology.Devices` }) ?? []
  const vpnEnabled = useWatch({ control, name: `Variants.${variantIndex}.Topology.VPN.Enabled` })
  const internetEnabled = useWatch({ control, name: `Variants.${variantIndex}.Topology.Internet.Enabled` })

  function optionsForNode(key: string) {
    if (key === "vpn" || key === "internet") {
      return connections.some((connection) => connection.Endpoints.some((endpoint) => endpoint.Kind === key))
        ? [] : [{ value: key, label: t(`admin.exTopo.endpoint.${key}`) }]
    }
    const device = devices.find((candidate) => candidate.ID === key)
    if (!device) return []
    const label = device.Name || device.ID.slice(0, 8)
    if (device.Type === "unmanaged-switch" || device.Type === "hub") return [{ value: `device:${key}:`, label }]
    return device.Interfaces.map((iface) => ({ value: `device:${key}:${iface.Name}`, label: `${label} · ${iface.Name}` }))
  }

  const endpointOptions = [
    ...(vpnEnabled ? [{ value: "vpn", label: t("admin.exTopo.endpoint.vpn") }] : []),
    ...(internetEnabled ? [{ value: "internet", label: t("admin.exTopo.endpoint.internet") }] : []),
    ...devices.flatMap((d) => {
      const label = d.Name || d.ID.slice(0, 8)
      if (d.Type === "unmanaged-switch" || d.Type === "hub") {
        return [{ value: `device:${d.ID}:`, label }]
      }
      return d.Interfaces.map((iface) => ({
        value: `device:${d.ID}:${iface.Name}`,
        label: `${label} · ${iface.Name}`,
      }))
    }),
  ]

  function optionsForEndpoint(connectionIndex: number, side: number) {
    return endpointOptions.filter((option) => {
      if (option.value !== "vpn" && option.value !== "internet") return true
      return !connections.some((connection, ci) => connection.Endpoints.some((endpoint, si) =>
        !(ci === connectionIndex && si === side) && endpoint.Kind === option.value))
    })
  }

  function addConnection() {
    append({
      Endpoints: [
        { Kind: "device", DeviceID: "", Interface: "" },
        { Kind: "device", DeviceID: "", Interface: "" },
      ],
    })
  }

  return (
    <div className="space-y-2">
      {pendingPair && !disabled && <CanvasConnectionChoice key={pendingPair.join(':')}
        firstOptions={optionsForNode(pendingPair[0])} secondOptions={optionsForNode(pendingPair[1])}
        onAdd={(first, second) => {
          append({ Endpoints: [decodeEndpoint(first), decodeEndpoint(second)] })
          onCanvasConnected?.()
        }} onCancel={onCanvasConnected ?? (() => {})} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5"><h4 className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.connections")}</h4><FieldHelp text={t("admin.exTopo.connectionsHelp")} /></div>
        {!disabled && fields.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={addConnection}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTopo.addConnection")}
          </Button>
        )}
      </div>

      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-2">
          <EmptyState message={t("admin.exTopo.noConnections")} compact />
          {!disabled && (
            <Button type="button" variant="outline" size="sm" className="mx-auto mb-3 flex" onClick={addConnection}>
              <Plus className="mr-1 h-4 w-4" />
              {t("admin.exTopo.addConnection")}
            </Button>
          )}
        </div>
      )}

      {fields.map((field, ci) => (
        <div key={field.id} className="flex flex-wrap items-center gap-2">
          {([0, 1] as const).map((side) => (
            <Controller
              key={side}
              control={control}
              name={`${name}.${ci}.Endpoints.${side}`}
              render={({ field: epField, fieldState }) => (
                <div className="min-w-52 flex-1">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t(side === 0 ? "admin.exTopo.endpoint.first" : "admin.exTopo.endpoint.second")}
                    <span className="text-destructive" aria-hidden="true">*</span>
                    <FieldHelp text={t("admin.exTopo.endpoint.help")} />
                  </div>
                  <SelectMenu
                    value={epField.value.Kind === "device" && epField.value.DeviceID === ""
                      ? ""
                      : encodeEndpoint(epField.value)}
                    onChange={(v) => epField.onChange(decodeEndpoint(v))}
                    disabled={disabled}
                    placeholder={t("admin.exTopo.endpoint.placeholder")}
                    ariaLabel={t(side === 0 ? "admin.exTopo.endpoint.first" : "admin.exTopo.endpoint.second")}
                    options={optionsForEndpoint(ci, side)}
                    className="w-full"
                  />
                  <p className="min-h-5 text-[0.8rem] font-medium leading-5 text-destructive">
                    {fieldState.error ? fieldState.error.message ?? t("admin.ex.val.endpointDevice") : ""}
                  </p>
                </div>
              )}
            />
          ))}
          {!disabled && (
            <RemoveAction ariaLabel={t("admin.exTopo.removeConnection")} onClick={() => remove(ci)} />
          )}
        </div>
      ))}
    </div>
  )
}

function CanvasConnectionChoice({ firstOptions, secondOptions, onAdd, onCancel }: {
  firstOptions: { value: string; label: string }[]
  secondOptions: { value: string; label: string }[]
  onAdd: (first: string, second: string) => void
  onCancel: () => void
}) {
  const [first, setFirst] = useState(firstOptions.length === 1 ? firstOptions[0].value : "")
  const [second, setSecond] = useState(secondOptions.length === 1 ? secondOptions[0].value : "")
  if (firstOptions.length === 0 || secondOptions.length === 0) return <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
    <p role="status" className="text-sm text-muted-foreground">{t("admin.exTopo.gatewayAlreadyConnected")}</p>
    <Button type="button" variant="outline" size="sm" onClick={onCancel}>{t("admin.exTopo.canvasCancel")}</Button>
  </div>
  return <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
    <p className="text-sm font-medium text-foreground">{t("admin.exTopo.canvasChooseInterfaces")}</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <SelectMenu value={first} onChange={setFirst} options={firstOptions} placeholder={t("admin.exTopo.endpoint.placeholder")} className="w-full" />
      <SelectMenu value={second} onChange={setSecond} options={secondOptions} placeholder={t("admin.exTopo.endpoint.placeholder")} className="w-full" />
    </div>
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onCancel}>{t("admin.exTopo.canvasCancel")}</Button>
      <Button type="button" size="sm" disabled={!first || !second} onClick={() => onAdd(first, second)}>{t("admin.exTopo.canvasConnect")}</Button>
    </div>
  </div>
}
