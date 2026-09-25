"use client"

import { useState } from "react"
import { useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { emptyDevice, type DraftFormValues } from "@/lib/exerciseSchemas"
import { NetworkToggles } from "./NetworkToggles"
import { DeviceCard } from "./DeviceCard"
import { RemoveAction } from "./RemoveAction"
import { ConnectionList } from "./ConnectionList"
import { TopologyDiagram } from "./TopologyDiagram"
import { useEditorPosition } from "./EditorPosition"

/** TopologySection — a variant's whole topology: networks, devices, connections. */
export function TopologySection({
  variantIndex,
  disabled,
}: {
  variantIndex: number
  disabled: boolean
}) {
  const { control, getValues, setValue } = useFormContext<DraftFormValues>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: `Variants.${variantIndex}.Topology.Devices`,
  })
  const topology = useWatch({ control, name: `Variants.${variantIndex}.Topology` })
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [activeSection, setActiveSection] = useEditorPosition("topologySection")
  const selectedDeviceIndex = topology?.Devices.findIndex((device) => `device:${device.ID}` === activeSection) ?? -1
  const visibleSection = activeSection.startsWith("device:") && selectedDeviceIndex < 0 ? "gateways" : activeSection
  const availableNodes = new Set([
    ...(topology?.Devices.map((device) => device.ID) ?? []),
    ...(topology?.VPN.Enabled ? ["vpn"] : []),
    ...(topology?.Internet.Enabled ? ["internet"] : []),
  ])
  const validSelection = selectedNodes.filter((key) => availableNodes.has(key))

  function moveNode(key: string, position: { x: number; y: number }) {
    const name = `Variants.${variantIndex}.Topology.VisualRender` as const
    const visual = getValues(name) ?? {}
    const positions = visual.positions && typeof visual.positions === "object" && !Array.isArray(visual.positions)
      ? visual.positions as Record<string, unknown> : {}
    setValue(name, { ...visual, version: 1, positions: { ...positions, [key]: position } }, { shouldDirty: true })
  }

  function addDevice() {
    const device = emptyDevice()
    append(device)
    setActiveSection(`device:${device.ID}`)
  }

  function removeDevice(index: number) {
    remove(index)
    setActiveSection("gateways")
  }

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t("admin.exDraft.topology.title")}
      </h3>
      <div className="exercise-settings-layout min-w-0 gap-4">
        <nav aria-label={t("admin.exDraft.topology.title")} className="min-w-0 space-y-1 rounded-md border border-border p-2">
          <button type="button" aria-current={visibleSection === "gateways" ? "page" : undefined}
            onClick={() => setActiveSection("gateways")}
            className={`w-full rounded-md px-3 py-2 text-left text-sm ${visibleSection === "gateways" ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {t("admin.exTopo.gateways")}
          </button>
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.devices")}</span>
          </div>
          {topology?.Devices.map((device, index) => (
            <div key={device.ID} className="group flex min-w-0 items-center gap-1">
            <button type="button" aria-current={visibleSection === `device:${device.ID}` ? "page" : undefined}
              onClick={() => setActiveSection(`device:${device.ID}`)}
              className={`min-w-0 flex-1 truncate rounded-md px-3 py-2 text-left text-sm ${visibleSection === `device:${device.ID}` ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {device.Name || `${t("admin.exTopo.unnamedDevice")} ${index + 1}`}
            </button>
            {!disabled && <RemoveAction ariaLabel={t("admin.exTopo.removeDevice")} onClick={() => removeDevice(index)} className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" />}
            </div>
          ))}
          {!disabled && fields.length > 0 && <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={addDevice}>
            <Plus className="mr-1 h-4 w-4" />{t("admin.exTopo.addDevice")}
          </Button>}
          <div className="border-t border-border pt-2">
            <button type="button" aria-current={visibleSection === "connections" ? "page" : undefined}
              onClick={() => setActiveSection("connections")}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${visibleSection === "connections" ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {t("admin.exTopo.connections")}
            </button>
          </div>
        </nav>
        <div className="min-w-0">
          {visibleSection === "gateways" && <div className="space-y-4">
            <NetworkToggles variantIndex={variantIndex} disabled={disabled} />
            {fields.length === 0 && <div className="rounded-lg border border-dashed border-border py-2">
              <EmptyState message={t("admin.exTopo.noDevices")} compact />
              {!disabled && <Button type="button" variant="outline" size="sm" className="mx-auto mb-3 flex" onClick={addDevice}>
                <Plus className="mr-1 h-4 w-4" />{t("admin.exTopo.addDevice")}
              </Button>}
            </div>}
          </div>}
          {selectedDeviceIndex >= 0 && visibleSection.startsWith("device:") && <DeviceCard
            key={fields[selectedDeviceIndex]?.id} variantIndex={variantIndex} deviceIndex={selectedDeviceIndex}
            disabled={disabled} />}
          {visibleSection === "connections" && <div className="space-y-4">
            {topology && availableNodes.size > 1 && <div>
              <h4 className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.diagram")}</h4>
              <TopologyDiagram topology={topology} onPositionChange={disabled ? undefined : moveNode}
                selectedNodes={validSelection}
                onNodeSelect={disabled ? undefined : (key) => setSelectedNodes((current) => {
                  const selected = current.filter((item) => availableNodes.has(item))
                  if (selected.length === 0 || selected.length === 2) return [key]
                  if (selected[0] === key) return []
                  return [selected[0], key]
                })} />
              {!disabled && <p className="mt-2 text-xs text-muted-foreground">{validSelection.length === 1 ? t("admin.exTopo.canvasSelectSecond") : t("admin.exTopo.canvasHint")}</p>}
            </div>}
            {(availableNodes.size > 1 || (topology?.Connections.length ?? 0) > 0) && <ConnectionList variantIndex={variantIndex} disabled={disabled}
              pendingPair={validSelection.length === 2 ? validSelection as [string, string] : null}
              onCanvasConnected={() => setSelectedNodes([])} />}
            {availableNodes.size <= 1 && (topology?.Connections.length ?? 0) === 0 && <EmptyState message={t("admin.exTopo.noConnections")} compact />}
          </div>}
        </div>
      </div>
    </section>
  )
}
