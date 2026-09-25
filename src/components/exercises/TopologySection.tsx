"use client"

import { useEffect, useState } from "react"
import { useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Maximize2, Minimize2, Plus, X } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { emptyDevice, type DraftFormValues } from "@/lib/exerciseSchemas"
import { availableDevicePorts } from "@/lib/topologyPorts"
import { TOPOLOGY_ICONS, topologyIconFor, type TopologyIconKey } from "@/lib/topologyIcons"
import type { DeviceType } from "@/api/exercises/versions"
import { NetworkToggles } from "./NetworkToggles"
import { DeviceCard } from "./DeviceCard"
import { RemoveAction } from "./RemoveAction"
import { ConnectionList } from "./ConnectionList"
import { TopologyConnectionDialog } from "./TopologyConnectionDialog"
import { TopologyDiagram } from "./TopologyDiagram"
import { TopologyGlyph } from "./TopologyGlyph"
import { useEditorPosition } from "./EditorPosition"

type Gateway = "vpn" | "internet"
const DEVICE_OPTIONS: { type: DeviceType; label: string; prefix: string }[] = [
  { type: "container", label: "admin.exTopo.type.container", prefix: "host" },
  { type: "unmanaged-switch", label: "admin.exTopo.type.switch", prefix: "sw" },
  { type: "hub", label: "admin.exTopo.type.hub", prefix: "hub" },
]

/** The form owns topology; only view, selection and transient actions live here. */
export function TopologySection({ variantIndex, disabled }: { variantIndex: number; disabled: boolean }) {
  const { control, getValues, setValue } = useFormContext<DraftFormValues>()
  const base = `Variants.${variantIndex}.Topology` as const
  const { fields, append, remove } = useFieldArray({ control, name: `${base}.Devices` })
  const topology = useWatch({ control, name: base })
  const devices = (topology?.Devices ?? []).slice(0, fields.length)
  const [activeSection, setActiveSection] = useEditorPosition("topologySection")
  const view = activeSection === "connections" ? "connections"
    : activeSection === "devices" || activeSection === "gateways" || activeSection.startsWith("device:") ? "devices" : "diagram"
  const [selectedKeyState, setSelectedKey] = useState<string | null>(null)
  const selectedKey = activeSection.startsWith("device:") ? activeSection.slice("device:".length) : selectedKeyState
  const [selectedConnectionIndex, setSelectedConnectionIndex] = useState<number | null>(null)
  const [settingsTarget, setSettingsTarget] = useState<string | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null)
  const [connectMode, setConnectMode] = useState(false)
  const [linkNodes, setLinkNodes] = useState<string[]>([])
  const [canvasExpanded, setCanvasExpanded] = useState(false)
  const selectedDeviceIndex = devices.findIndex((device) => device.ID === selectedKey)
  const settingsDeviceIndex = devices.findIndex((device) => device.ID === settingsTarget)
  const selectedGateway = selectedKey === "vpn" || selectedKey === "internet" ? selectedKey : null
  const settingsGateway = settingsTarget === "vpn" || settingsTarget === "internet" ? settingsTarget : null
  const availableNodes = new Set([
    ...devices.map((device) => device.ID),
    ...(topology?.VPN.Enabled ? ["vpn"] : []),
    ...(topology?.Internet.Enabled ? ["internet"] : []),
  ])
  const unavailableConnectionNodes = [
    ...devices.filter((device) => availableDevicePorts({ Connections: topology?.Connections ?? [] }, device).length === 0).map((device) => device.ID),
    ...(["vpn", "internet"] as const).filter((kind) => (topology?.[kind === "vpn" ? "VPN" : "Internet"].Enabled ?? false)
      && (topology?.Connections ?? []).some((connection) => connection.Endpoints.some((endpoint) => endpoint.Kind === kind))),
  ]
  const freeConnectionNodeCount = availableNodes.size - unavailableConnectionNodes.length
  const pendingPair = connectMode && linkNodes.length === 2 ? linkNodes as [string, string] : null
  const linkedCount = (topology?.Connections ?? []).filter((connection) => connection.Endpoints.some((endpoint) =>
    endpoint.Kind === pendingRemoval || (endpoint.Kind === "device" && endpoint.DeviceID === pendingRemoval))).length

  useEffect(() => {
    if (!connectMode) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setConnectMode(false); setLinkNodes([]) }
    }
    document.addEventListener("keydown", onEscape)
    return () => document.removeEventListener("keydown", onEscape)
  }, [connectMode])

  useEffect(() => {
    if (!settingsTarget) return
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSettingsTarget(null) }
    document.addEventListener("keydown", onEscape)
    return () => document.removeEventListener("keydown", onEscape)
  }, [settingsTarget])

  useEffect(() => {
    if (!canvasExpanded) return
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setCanvasExpanded(false)
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [canvasExpanded])

  function exitExpandedCanvas() {
    setCanvasExpanded(false)
    if (document.fullscreenElement === document.documentElement) void document.exitFullscreen?.().catch(() => {})
  }

  function toggleExpandedCanvas() {
    if (canvasExpanded) { exitExpandedCanvas(); return }
    setCanvasExpanded(true)
    void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  function moveNode(key: string, position: { x: number; y: number }) {
    const visual = getValues(`${base}.VisualRender`) ?? {}
    const positions = visual.positions && typeof visual.positions === "object" && !Array.isArray(visual.positions)
      ? visual.positions as Record<string, unknown> : {}
    setValue(`${base}.VisualRender`, { ...visual, version: 1, positions: { ...positions, [key]: position } }, { shouldDirty: true })
  }

  function setIcon(key: string, icon: TopologyIconKey) {
    const visual = getValues(`${base}.VisualRender`) ?? {}
    const icons = visual.icons && typeof visual.icons === "object" && !Array.isArray(visual.icons)
      ? visual.icons as Record<string, unknown> : {}
    setValue(`${base}.VisualRender`, { ...visual, version: 1, icons: { ...icons, [key]: icon } }, { shouldDirty: true })
  }

  function moveLabel(key: string, offset: { x: number; y: number }) {
    const visual = getValues(`${base}.VisualRender`) ?? {}
    const labelOffsets = visual.labelOffsets && typeof visual.labelOffsets === "object" && !Array.isArray(visual.labelOffsets)
      ? visual.labelOffsets as Record<string, unknown> : {}
    setValue(`${base}.VisualRender`, { ...visual, version: 1, labelOffsets: { ...labelOffsets, [key]: offset } }, { shouldDirty: true })
  }

  function addDevice(type: DeviceType, position?: { x: number; y: number }) {
    const option = DEVICE_OPTIONS.find((candidate) => candidate.type === type)!
    const names = new Set(devices.map((device) => device.Name))
    let number = 1
    while (names.has(`${option.prefix}-${number}`)) number++
    const device = emptyDevice()
    device.Name = `${option.prefix}-${number}`
    device.Type = type
    if (type !== "container") device.Interfaces = []
    append(device)
    if (position) moveNode(device.ID, position)
    setSelectedKey(device.ID)
    setSelectedConnectionIndex(null)
  }

  function addGateway(kind: Gateway, position?: { x: number; y: number }) {
    const branch = kind === "vpn" ? "VPN" : "Internet"
    if (getValues(`${base}.${branch}.Enabled`)) return
    setValue(`${base}.${branch}.Enabled`, true, { shouldDirty: true, shouldValidate: true })
    if (position) moveNode(kind, position)
    setSelectedKey(kind)
    setSelectedConnectionIndex(null)
  }

  function openSettings(key: string) {
    setSelectedKey(key)
    setSettingsTarget(key)
  }

  function selectNode(key: string) {
    if (connectMode && unavailableConnectionNodes.includes(key)) return
    setSelectedKey(key)
    setSelectedConnectionIndex(null)
    if (settingsTarget && settingsTarget !== key) setSettingsTarget(null)
    if (!connectMode) return
    setLinkNodes((current) => current.length === 0 || current.length === 2
      ? [key] : current[0] === key ? [] : [current[0], key])
  }

  function cancelConnect() { setConnectMode(false); setLinkNodes([]) }

  function confirmRemoval() {
    if (!pendingRemoval) return
    const target = pendingRemoval
    setValue(`${base}.Connections`, getValues(`${base}.Connections`).filter((connection) =>
      !connection.Endpoints.some((endpoint) => endpoint.Kind === target ||
        (endpoint.Kind === "device" && endpoint.DeviceID === target))), { shouldDirty: true, shouldValidate: true })
    if (target === "vpn" || target === "internet") {
      const branch = target === "vpn" ? "VPN" : "Internet"
      setValue(`${base}.${branch}.Enabled`, false, { shouldDirty: true, shouldValidate: true })
    } else {
      const index = devices.findIndex((device) => device.ID === target)
      if (index >= 0) remove(index)
    }
    if (selectedKey === target) setSelectedKey(null)
    if (activeSection === `device:${target}`) setActiveSection("devices")
    if (settingsTarget === target) setSettingsTarget(null)
    setSelectedConnectionIndex(null)
    setLinkNodes((nodes) => nodes.filter((key) => key !== target))
    setPendingRemoval(null)
  }

  function iconChoices(index: number) {
    const device = devices[index]
    if (!device) return null
    return <div className="min-w-0 space-y-2 border-b border-border pb-3">
      <span className="text-sm font-medium">{t("admin.exTopo.icon.title")}</span>
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
      {(Object.keys(TOPOLOGY_ICONS) as TopologyIconKey[]).map((key) =>
        <button key={key} type="button" aria-label={t(`admin.exTopo.icon.${key}`)}
          aria-pressed={topologyIconFor(device, topology?.VisualRender ?? null) === key}
          disabled={disabled} onClick={() => setIcon(device.ID, key)}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-background p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary">
          <TopologyGlyph kind={key} className="h-9 w-9 text-foreground" />
        </button>)}
      </div>
    </div>
  }

  return <section data-testid="topology-workspace" className={canvasExpanded
    ? "fixed inset-0 z-[45] flex h-dvh min-h-0 min-w-0 flex-col bg-background p-2 sm:p-3"
    : "flex min-h-[32rem] min-w-0 flex-col gap-3 lg:h-[min(72dvh,48rem)]"}>
    {!canvasExpanded && <nav aria-label={t("admin.exDraft.topology.title")} className="flex shrink-0 gap-1 border-b border-border">
      {(["diagram", "devices", "connections"] as const).map((item) =>
        <button key={item} type="button" aria-current={view === item ? "page" : undefined}
          onClick={() => { cancelConnect(); exitExpandedCanvas(); setSettingsTarget(null); setActiveSection(item) }}
          className="rounded-t-md px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary aria-current:border-b-2 aria-current:border-primary aria-current:text-primary">
          {t(`admin.exTopo.${item}`)}
        </button>)}
    </nav>}

    {view === "diagram" && <div data-testid="topology-canvas-layout" className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden xl:flex-row">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-sm font-medium">{t("admin.exTopo.diagram")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {connectMode && <span className="text-xs text-muted-foreground">{linkNodes.length === 0 ? t("admin.exTopo.canvasSelectFirst") : t("admin.exTopo.canvasSelectSecond")}</span>}
          {!disabled && (connectMode ? <Button type="button" variant="outline" size="sm" onClick={cancelConnect}>{t("admin.exTopo.canvasCancel")}</Button>
            : <Button type="button" variant="outline" size="sm" disabled={freeConnectionNodeCount < 2} onClick={() => { setConnectMode(true); setLinkNodes([]) }}>
              <Plus className="mr-1 h-4 w-4" />{t("admin.exTopo.addConnection")}
            </Button>)}
          {!disabled && <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" aria-label={t("admin.exTopo.addDevice")}><Plus className="mr-1 h-4 w-4" />{t("admin.exTopo.addDevice")}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {DEVICE_OPTIONS.map((option) => <DropdownMenuItem key={option.type} onSelect={() => addDevice(option.type)}>{t(option.label)}</DropdownMenuItem>)}
              <DropdownMenuItem disabled={topology?.VPN.Enabled} onSelect={() => addGateway("vpn")}>{t("admin.exTopo.vpn")}</DropdownMenuItem>
              <DropdownMenuItem disabled={topology?.Internet.Enabled} onSelect={() => addGateway("internet")}>{t("admin.exTopo.internet")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
          <Button type="button" variant="ghost" size="sm" onClick={toggleExpandedCanvas}
            aria-label={t(canvasExpanded ? "admin.exTopo.collapseCanvas" : "admin.exTopo.expandCanvas")}
            title={t(canvasExpanded ? "admin.exTopo.collapseCanvas" : "admin.exTopo.expandCanvas")}
            className="h-8 w-8 shrink-0 p-0">
            {canvasExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {topology && <TopologyDiagram topology={topology} onPositionChange={disabled ? undefined : moveNode}
          onLabelOffsetChange={disabled ? undefined : moveLabel}
          selectedNodes={connectMode ? linkNodes : selectedKey ? [selectedKey] : []}
          connectionMode={connectMode} unavailableConnectionNodes={unavailableConnectionNodes}
          selectedConnectionIndex={selectedConnectionIndex} onEdgeSelect={(index) => { setSelectedConnectionIndex(index); setSelectedKey(null) }}
          onNodeSelect={selectNode} onNodeSettings={disabled ? undefined : openSettings}
          onNodeRemove={disabled ? undefined : setPendingRemoval}
          onNodeLinkStart={disabled ? undefined : (key) => { if (unavailableConnectionNodes.includes(key)) return; setSelectedKey(key); setConnectMode(true); setLinkNodes([key]) }}
          onCanvasSelect={() => { if (!connectMode) { setSelectedKey(null); setSelectedConnectionIndex(null); setSettingsTarget(null) } }}
          onCanvasAddNode={disabled ? undefined : (kind, position) => kind === "vpn" || kind === "internet"
            ? addGateway(kind, position) : addDevice(kind, position)}
          onCanvasLinkStart={disabled || freeConnectionNodeCount < 2 ? undefined : () => { setConnectMode(true); setLinkNodes([]) }} />}
      </div>
      {availableNodes.size === 0 && <div className="p-3 text-center text-sm text-muted-foreground">{t("admin.exTopo.noDevices")}</div>}
    </div>
    {settingsTarget !== null && <aside role="complementary"
      aria-label={settingsGateway ? t(`admin.exTopo.${settingsGateway}`) : t("admin.exTopo.deviceSettings")}
      className="absolute inset-y-0 right-0 z-10 flex w-[min(26rem,calc(100vw-1rem))] min-h-0 min-w-0 flex-col border-l border-border bg-background shadow-lg xl:static xl:ml-2 xl:w-1/5 xl:min-w-[17rem] xl:max-w-[28rem] xl:rounded-md xl:border xl:shadow-none">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-3">
        <div className="min-w-0"><h3 className="truncate text-sm font-semibold">{settingsGateway ? t(`admin.exTopo.${settingsGateway}`) : t("admin.exTopo.deviceSettings")}</h3>
          <p className="text-xs text-muted-foreground">{settingsGateway ? t("admin.exTopo.connectionsHelp") : t("admin.exTopo.deviceNameHelp")}</p></div>
        <Button type="button" variant="ghost" size="sm" aria-label={t("admin.exTopo.closeSettings")}
          title={t("admin.exTopo.closeSettings")} className="h-8 w-8 shrink-0 p-0" onClick={() => setSettingsTarget(null)}><X className="h-4 w-4" /></Button>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
        {settingsGateway ? <NetworkToggles variantIndex={variantIndex} disabled={disabled}
          network={settingsGateway === "vpn" ? "VPN" : "Internet"} showEnabled={false} />
          : settingsDeviceIndex >= 0 && <div className="min-w-0 space-y-3">{iconChoices(settingsDeviceIndex)}
            <DeviceCard key={fields[settingsDeviceIndex]?.id} variantIndex={variantIndex} deviceIndex={settingsDeviceIndex} disabled={disabled} compact /></div>}
      </div>
    </aside>}
    </div>}

    {view === "devices" && <div className="grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden md:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="min-h-0 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.devices")}</div>
        {devices.map((device, index) => <div key={device.ID} className={`group flex items-center rounded-md ${selectedKey === device.ID ? "bg-accent" : "hover:bg-muted/60 focus-within:bg-muted/60"}`}>
          <button type="button" aria-current={selectedKey === device.ID ? "page" : undefined} onClick={() => { setSelectedKey(device.ID); setSelectedConnectionIndex(null); setActiveSection(`device:${device.ID}`) }}
            className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary">{device.Name || `${t("admin.exTopo.unnamedDevice")} ${index + 1}`}</button>
          {!disabled && <RemoveAction ariaLabel={t("admin.exTopo.removeDevice")} onClick={() => setPendingRemoval(device.ID)} className="h-8 w-8 shrink-0 px-0" />}
        </div>)}
        {(["vpn", "internet"] as const).filter((kind) => topology?.[kind === "vpn" ? "VPN" : "Internet"].Enabled).map((kind) =>
          <div key={kind} className={`group flex items-center rounded-md ${selectedKey === kind ? "bg-accent" : "hover:bg-muted/60 focus-within:bg-muted/60"}`}>
            <button type="button" aria-current={selectedKey === kind ? "page" : undefined} onClick={() => { setSelectedKey(kind); setSelectedConnectionIndex(null); setActiveSection(`device:${kind}`) }}
              className="min-w-0 flex-1 px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary">{t(`admin.exTopo.${kind}`)}</button>
            {!disabled && <RemoveAction ariaLabel={t("admin.exTopo.removeDevice")} onClick={() => setPendingRemoval(kind)} className="h-8 w-8 shrink-0 px-0" />}
          </div>)}
      </div>
      <div className="min-h-0 min-w-0 overflow-y-auto rounded-md border border-border p-3">
        {selectedDeviceIndex >= 0 ? <div className="space-y-3">
          {iconChoices(selectedDeviceIndex)}
          <DeviceCard key={fields[selectedDeviceIndex]?.id} variantIndex={variantIndex} deviceIndex={selectedDeviceIndex} disabled={disabled} />
        </div> : selectedGateway ? <NetworkToggles variantIndex={variantIndex} disabled={disabled}
          network={selectedGateway === "vpn" ? "VPN" : "Internet"} showEnabled={false} />
          : <p className="text-sm text-muted-foreground">{t("admin.exTopo.noDevices")}</p>}
      </div>
    </div>}

    {view === "connections" && <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-md border border-border p-3">
      <ConnectionList variantIndex={variantIndex} disabled={disabled} selectedIndex={selectedConnectionIndex}
        onSelectIndex={(index) => { setSelectedConnectionIndex(index); setSelectedKey(null) }} />
    </div>}

    {!disabled && <TopologyConnectionDialog variantIndex={variantIndex} pair={pendingPair} onClose={cancelConnect}
      onAdd={(first, second) => {
        setValue(`${base}.Connections`, [...getValues(`${base}.Connections`), { Endpoints: [first, second] }], { shouldDirty: true, shouldValidate: true })
        cancelConnect()
      }} />}
    <Dialog open={pendingRemoval !== null} onOpenChange={(open) => { if (!open) setPendingRemoval(null) }}>
      <DialogContent><DialogHeader><DialogTitle>{t("admin.exTopo.removeDevice")}</DialogTitle>
        <DialogDescription>{t("admin.exTopo.removeDeviceConfirm").replace("{count}", String(linkedCount))}</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setPendingRemoval(null)}>{t("admin.exTopo.canvasCancel")}</Button>
          <Button type="button" variant="destructive" onClick={confirmRemoval}>{t("admin.exTopo.removeDevice")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
}
