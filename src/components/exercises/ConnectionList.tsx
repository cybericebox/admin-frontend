"use client"

import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import type { NormalizedEndpoint } from "@/api/exercises/versions"
import type { DraftFormValues } from "@/lib/exerciseSchemas"

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
}: {
  variantIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Topology.Connections` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const devices = useWatch({ control, name: `Variants.${variantIndex}.Topology.Devices` }) ?? []

  const endpointOptions = [
    { value: "vpn", label: t("admin.exTopo.endpoint.vpn") },
    { value: "internet", label: t("admin.exTopo.endpoint.internet") },
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
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.connections")}</h4>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addConnection}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTopo.addConnection")}
          </Button>
        )}
      </div>

      {fields.map((field, ci) => (
        <div key={field.id} className="flex flex-wrap items-center gap-2">
          {([0, 1] as const).map((side) => (
            <Controller
              key={side}
              control={control}
              name={`${name}.${ci}.Endpoints.${side}`}
              render={({ field: epField, fieldState }) => (
                <div className="min-w-52 flex-1">
                  <SelectMenu
                    value={epField.value.Kind === "device" && epField.value.DeviceID === ""
                      ? ""
                      : encodeEndpoint(epField.value)}
                    onChange={(v) => epField.onChange(decodeEndpoint(v))}
                    disabled={disabled}
                    placeholder={t("admin.exTopo.endpoint.placeholder")}
                    options={endpointOptions}
                    className="w-full"
                  />
                  {fieldState.error && (
                    <p className="text-[0.8rem] font-medium text-destructive">
                      {fieldState.error.message ?? t("admin.ex.val.endpointDevice")}
                    </p>
                  )}
                </div>
              )}
            />
          ))}
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`remove-connection-${ci}`}
              onClick={() => remove(ci)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
