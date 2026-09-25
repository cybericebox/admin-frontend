"use client"

import { useState } from "react"
import { useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { ChevronDown, Plus } from "lucide-react"
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
  const devices = (topology?.Devices ?? []).slice(0, fields.length)
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [devicesExpanded, setDevicesExpanded] = useState(true)
  const [activeSection, setActiveSection] = useEditorPosition("topologySection")
  const requestedDeviceIndex = devices.findIndex((device) => `device:${device.ID}` === activeSection)
  const visibleSection = (activeSection === "devices" || (activeSection.startsWith("device:") && requestedDeviceIndex < 0)) && devices[0]
    ? `device:${devices[0].ID}` : activeSection
  const selectedDeviceIndex = devices.findIndex((device) => `device:${device.ID}` === visibleSection)
  const activeTab = visibleSection === "gateways" ? "general" : visibleSection === "connections" || visibleSection === "diagram" ? visibleSection : "devices"
  const availableNodes = new Set([
    ...devices.map((device) => device.ID),
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
    setDevicesExpanded(true)
    setActiveSection(`device:${device.ID}`)
  }

  function removeDevice(index: number) {
    remove(index)
    setActiveSection("devices")
  }

  return (
    <section className="exercise-settings-layout min-w-0 gap-4">
      <nav aria-label={t("admin.exDraft.topology.title")} className="min-w-0 space-y-1 rounded-md border border-border p-2">
        <button type="button" aria-current={activeTab === "general" ? "page" : undefined} onClick={() => setActiveSection("gateways")}
          className={`w-full rounded-md px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary ${activeTab === "general" ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{t("admin.exTopo.general")}</button>
        <div className="border-t border-border pt-2">
          <div className="flex items-center justify-between gap-1 px-1">
            <button type="button" aria-expanded={devicesExpanded} aria-controls={`topology-devices-${variantIndex}`}
              onClick={() => { setDevicesExpanded((expanded) => !expanded); if (!devices.length) setActiveSection("devices") }}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
              {t("admin.exTopo.devices")}
              <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${devicesExpanded ? "" : "-rotate-90"}`} />
            </button>
            {!disabled && <Button type="button" variant="ghost" size="sm" aria-label={t("admin.exTopo.addDevice")} onClick={addDevice}><Plus className="h-4 w-4" /></Button>}
          </div>
          <div id={`topology-devices-${variantIndex}`} hidden={!devicesExpanded}>{devices.map((device, index) => <div key={device.ID} className="group flex min-w-0 items-center gap-1 rounded-md hover:bg-muted/60 focus-within:bg-muted/60">
            <button type="button" aria-current={visibleSection === `device:${device.ID}` ? "page" : undefined}
              onClick={() => setActiveSection(`device:${device.ID}`)}
              className={`min-w-0 flex-1 truncate rounded-md px-4 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary ${visibleSection === `device:${device.ID}` ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {device.Name || `${t("admin.exTopo.unnamedDevice")} ${index + 1}`}
            </button>
            {!disabled && <RemoveAction ariaLabel={t("admin.exTopo.removeDevice")} onClick={() => removeDevice(index)} className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" />}
          </div>)}</div>
        </div>
        <div className="border-t border-border pt-2">
          {(["connections", "diagram"] as const).map((section) => <button key={section} type="button" aria-current={activeTab === section ? "page" : undefined}
            onClick={() => setActiveSection(section)}
            className={`w-full rounded-md px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary ${activeTab === section ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{t(`admin.exTopo.${section}`)}</button>)}
        </div>
      </nav>
      <div className="min-w-0 rounded-md border border-border p-3">
        {activeTab === "general" && <NetworkToggles variantIndex={variantIndex} disabled={disabled} />}
        {activeTab === "devices" && <>
          {selectedDeviceIndex >= 0 && <DeviceCard key={fields[selectedDeviceIndex]?.id} variantIndex={variantIndex} deviceIndex={selectedDeviceIndex} disabled={disabled} />}
          {fields.length === 0 && <EmptyState message={t("admin.exTopo.noDevices")} compact />}
        </>}
        {activeTab === "connections" && <>
        {(availableNodes.size > 1 || (topology?.Connections.length ?? 0) > 0) ? <ConnectionList variantIndex={variantIndex} disabled={disabled}
          pendingPair={validSelection.length === 2 ? validSelection as [string, string] : null}
          onCanvasConnected={() => setSelectedNodes([])} /> : <EmptyState message={t("admin.exTopo.noConnections")} compact />}
        </>}
        {activeTab === "diagram" && <div className="min-w-0 space-y-3">
        {topology && availableNodes.size > 0 ? <TopologyDiagram topology={topology} onPositionChange={disabled ? undefined : moveNode}
          selectedNodes={validSelection}
          onNodeSelect={disabled ? undefined : (key) => setSelectedNodes((current) => {
            const selected = current.filter((item) => availableNodes.has(item))
            if (selected.length === 0 || selected.length === 2) return [key]
            if (selected[0] === key) return []
            return [selected[0], key]
          })} /> : <EmptyState message={t("admin.exTopo.noDevices")} compact />}
        {!disabled && availableNodes.size > 1 && <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{validSelection.length === 1 ? t("admin.exTopo.canvasSelectSecond") : t("admin.exTopo.canvasHint")}</p>
          {validSelection.length === 2 && <Button type="button" size="sm" onClick={() => setActiveSection("connections")}>{t("admin.exTopo.addConnection")}</Button>}
        </div>}
        </div>}
      </div>
    </section>
  )
}
