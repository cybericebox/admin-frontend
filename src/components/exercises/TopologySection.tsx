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
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyDevice())}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTopo.addDevice")}
          </Button>
        )}
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
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

      <ConnectionList variantIndex={variantIndex} disabled={disabled} />

      {topology && (
        <div>
          <h4 className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.diagram")}</h4>
          <TopologyDiagram topology={topology} />
        </div>
      )}
    </section>
  )
}
