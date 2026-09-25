"use client"

import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import { EmptyState } from "@/components/ui/empty-state"
import type { NormalizedEndpoint } from "@/api/exercises/versions"
import type { DraftFormValues } from "@/lib/exerciseSchemas"
import { availableDevicePorts, GATEWAY_PORT, shortForwardingPort } from "@/lib/topologyPorts"
import { RemoveAction } from "./RemoveAction"
import { FieldHelp } from "@/components/ui/field-help"

/** Encode one connection endpoint into a select value: vpn | internet | device:<id>:<iface>. */
export function encodeEndpoint(ep: NormalizedEndpoint): string {
  if (ep.Kind === "device") return `device:${ep.DeviceID}:${ep.Interface}`
  return ep.Kind
}

export function decodeEndpoint(value: string): NormalizedEndpoint {
  if (value === "vpn" || value === "internet") {
    return { Kind: value, DeviceID: "", Interface: GATEWAY_PORT }
  }
  const rest = value.slice("device:".length)
  const sep = rest.indexOf(":")
  return { Kind: "device", DeviceID: rest.slice(0, sep), Interface: rest.slice(sep + 1) }
}

/**
 * ConnectionList — pairs of endpoints ("device/interface" | VPN | Internet).
 * Devices are addressed by ID (new devices already have a client-side uuid);
 * a switch/hub endpoint names one of 48 logical forwarding ports.
 */
export function ConnectionList({
  variantIndex,
  disabled,
  selectedIndex,
  onSelectIndex,
}: {
  variantIndex: number
  disabled: boolean
  selectedIndex?: number | null
  onSelectIndex?: (index: number) => void
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Topology.Connections` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const connections = useWatch({ control, name }) ?? []
  const devices = useWatch({ control, name: `Variants.${variantIndex}.Topology.Devices` }) ?? []
  const vpnEnabled = useWatch({ control, name: `Variants.${variantIndex}.Topology.VPN.Enabled` })
  const internetEnabled = useWatch({ control, name: `Variants.${variantIndex}.Topology.Internet.Enabled` })

  function optionsForEndpoint(connectionIndex: number, side: number) {
    const endpointOptions = [
      ...(vpnEnabled ? [{ value: "vpn", label: `${t("admin.exTopo.endpoint.vpn")} · ${GATEWAY_PORT}` }] : []),
      ...(internetEnabled ? [{ value: "internet", label: `${t("admin.exTopo.endpoint.internet")} · ${GATEWAY_PORT}` }] : []),
      ...devices.flatMap((d) => {
        const label = d.Name || d.ID.slice(0, 8)
        return availableDevicePorts({ Connections: connections }, d, { connectionIndex, side })
          .map((port) => ({ value: `device:${d.ID}:${port}`, label: `${label} · ${shortForwardingPort(port)}` }))
      }),
    ]
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
        <div className="py-2">
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
        <div key={field.id} data-testid={`connection-row-${ci}`} onClick={() => onSelectIndex?.(ci)}
          className={`flex flex-wrap items-center gap-2 rounded-md px-2 pt-2 ${selectedIndex === ci ? "bg-accent" : "hover:bg-muted/60"}`}>
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
