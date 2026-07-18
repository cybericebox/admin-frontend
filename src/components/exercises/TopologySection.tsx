"use client"

import { useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { emptyDevice, type DraftFormValues } from "@/lib/exerciseSchemas"
import { NetworkToggles } from "./NetworkToggles"
import { DeviceCard } from "./DeviceCard"
import { ConnectionList } from "./ConnectionList"
import { TopologyDiagram } from "./TopologyDiagram"

/** TopologySection — a variant's whole topology: networks, devices, connections. */
export function TopologySection({
  variantIndex,
  disabled,
}: {
  variantIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: `Variants.${variantIndex}.Topology.Devices`,
  })
  const topology = useWatch({ control, name: `Variants.${variantIndex}.Topology` })

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t("admin.exDraft.topology.title")}
      </h3>

      <NetworkToggles variantIndex={variantIndex} disabled={disabled} />

      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.devices")}</h4>
        {!disabled && fields.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyDevice())}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTopo.addDevice")}
          </Button>
        )}
      </div>
      {fields.length === 0 ? (
        // Empty state: a centered prompt reads better than a lone right-aligned
        // button over blank space.
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">{t("admin.exTopo.noDevices")}</p>
          {!disabled && (
            <Button type="button" variant="outline" size="sm" onClick={() => append(emptyDevice())}>
              <Plus className="mr-1 h-4 w-4" />
              {t("admin.exTopo.addDevice")}
            </Button>
          )}
        </div>
      ) : (
        // Full-width stack, not a 2-col grid: device cards have variable height
        // (interfaces, env vars), so a rigid grid would leave uneven empty columns.
        <div className="space-y-3">
          {fields.map((field, di) => (
            <DeviceCard
              key={field.id}
              variantIndex={variantIndex}
              deviceIndex={di}
              disabled={disabled}
              onRemove={() => remove(di)}
            />
          ))}
        </div>
      )}

      <ConnectionList variantIndex={variantIndex} disabled={disabled} />

      {/* Diagram only once there is something to draw — an empty canvas is just
          a large blank box. */}
      {topology && fields.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.diagram")}</h4>
          <TopologyDiagram topology={topology} />
        </div>
      )}
    </section>
  )
}
