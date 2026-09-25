"use client"

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react"
import { t } from "@/i18n/t"
import type { TopologyFormValues } from "@/lib/exerciseSchemas"
import { shortForwardingPort } from "@/lib/topologyPorts"
import { topologyIconFor, type TopologyIconKey } from "@/lib/topologyIcons"
import { TopologyGlyph, type TopologyGlyphKind } from "./TopologyGlyph"

/**
 * TopologyDiagram — topology canvas. Positions are stored in VisualRender while
 * the device/connection form remains the authoritative topology model.
 *
 * Form values are the source of truth. Automatic positions follow the network
 * reading order (uplinks → forwarding devices → containers); editor positions
 * override them. No external graph library or second topology model.
 */

type NodeKind = "device" | "forwarding" | "vpn" | "internet"
type DiagramNode = { key: string; label: string; kind: NodeKind; icon?: TopologyIconKey }
type DiagramEdge = { key: string; index: number; a: string; b: string; labelA: string; labelB: string }
type Point = { x: number; y: number }
type AddNodeKind = "container" | "unmanaged-switch" | "hub" | "vpn" | "internet"
type Context = { kind: "node"; key: string; x: number; y: number }
  | { kind: "canvas"; x: number; y: number; position: Point }

const DEFAULT_SIZE = { width: 960, height: 560 }
const ICON_SIZE = 56
const GLYPH_SIZE = 38
const GLYPH_UNIT = GLYPH_SIZE / 24
const GLYPH_BOUNDS: Record<TopologyGlyphKind, { halfX: number; halfY: number; radius?: number }> = {
  host: { halfX: 8 * GLYPH_UNIT, halfY: 10 * GLYPH_UNIT },
  switch: { halfX: 10 * GLYPH_UNIT, halfY: 10 * GLYPH_UNIT },
  "switch-l3": { halfX: 10 * GLYPH_UNIT, halfY: 10 * GLYPH_UNIT },
  hub: { halfX: 10 * GLYPH_UNIT, halfY: 8 * GLYPH_UNIT },
  router: { halfX: 10 * GLYPH_UNIT, halfY: 10 * GLYPH_UNIT, radius: 10 * GLYPH_UNIT },
  firewall: { halfX: 9 * GLYPH_UNIT, halfY: 10.5 * GLYPH_UNIT },
  vpn: { halfX: 8.75 * GLYPH_UNIT, halfY: 10.75 * GLYPH_UNIT },
  internet: { halfX: 9.75 * GLYPH_UNIT, halfY: 9.75 * GLYPH_UNIT, radius: 9.75 * GLYPH_UNIT },
}
const LABEL_GAP = 17
const MIN_X = 70
const MIN_Y = 48

function clampPoint(point: Point, width: number, height: number): Point {
  return { x: Math.max(MIN_X, Math.min(width - MIN_X, point.x)), y: Math.max(MIN_Y, Math.min(height - MIN_Y, point.y)) }
}

function storedPosition(visual: Record<string, unknown> | null, key: string, width: number, height: number): Point | null {
  const positions = visual?.positions
  if (!positions || typeof positions !== "object" || Array.isArray(positions)) return null
  const candidate = (positions as Record<string, unknown>)[key]
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null
  const { x, y } = candidate as Record<string, unknown>
  return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1 && typeof y === "number" && Number.isFinite(y) && y >= 0 && y <= 1
    ? clampPoint({ x: x * width, y: y * height }, width, height) : null
}

function storedLabelOffset(visual: Record<string, unknown> | null, key: string): Point {
  const offsets = visual?.labelOffsets
  if (!offsets || typeof offsets !== "object" || Array.isArray(offsets)) return { x: 0, y: 0 }
  const candidate = (offsets as Record<string, unknown>)[key]
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return { x: 0, y: 0 }
  const { x, y } = candidate as Record<string, unknown>
  return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)
    ? { x, y } : { x: 0, y: 0 }
}

function rowGeometry(nodes: DiagramNode[], width: number) {
  const hasGateway = nodes.some((node) => node.kind === "vpn" || node.kind === "internet")
  const forwardingRows = Math.ceil(nodes.filter((node) => node.kind === "forwarding").length / 4)
  const containerColumns = width < 800 ? 4 : 5
  const containerRows = Math.ceil(nodes.filter((node) => node.kind === "device").length / containerColumns)
  const forwardingStart = hasGateway ? 260 : 120
  const containerStart = forwardingRows ? forwardingStart + (forwardingRows - 1) * 105 + 155 : hasGateway ? 260 : 120
  return { forwardingRows, containerRows, containerColumns, forwardingStart, containerStart }
}

function layout(nodes: DiagramNode[], visual: Record<string, unknown> | null, width: number, height: number): Map<string, Point> {
  const pos = new Map<string, Point>()
  const gateways = nodes.filter((node) => node.kind === "vpn" || node.kind === "internet")
  const forwarding = nodes.filter((node) => node.kind === "forwarding")
  const containers = nodes.filter((node) => node.kind === "device")
  const { containerColumns, forwardingStart, containerStart } = rowGeometry(nodes, width)
  const place = (group: DiagramNode[], y: number, rowSize = 5) => group.forEach((node, index) => {
    const row = Math.floor(index / rowSize)
    const count = Math.min(rowSize, group.length - row * rowSize)
    const column = index % rowSize
    const x = ((column + 1) * width) / (count + 1)
    pos.set(node.key, storedPosition(visual, node.key, width, height) ?? clampPoint({ x, y: y + row * 105 }, width, height))
  })
  place(gateways, 105, 2)
  place(forwarding, forwardingStart, 4)
  place(containers, containerStart, containerColumns)
  return pos
}

function minimumCanvasHeight(nodes: DiagramNode[], width: number): number {
  const { forwardingRows, containerRows, forwardingStart, containerStart } = rowGeometry(nodes, width)
  const lastRowY = containerRows ? containerStart + (containerRows - 1) * 105
    : forwardingRows ? forwardingStart + (forwardingRows - 1) * 105 : 105
  return Math.max(DEFAULT_SIZE.height, lastRowY + 100)
}

function glyphForNode(node: DiagramNode | undefined): TopologyGlyphKind {
  return node?.kind === "vpn" || node?.kind === "internet" ? node.kind : node?.icon ?? "host"
}

function edgePort(from: Point, to: Point, glyph: TopologyGlyphKind): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (!dx && !dy) return from
  const bounds = GLYPH_BOUNDS[glyph]
  const scale = bounds.radius
    ? bounds.radius / Math.hypot(dx, dy)
    : Math.min(bounds.halfX / (Math.abs(dx) || 1), bounds.halfY / (Math.abs(dy) || 1))
  return { x: Number((from.x + dx * scale).toFixed(2)), y: Number((from.y + dy * scale).toFixed(2)) }
}

export function TopologyDiagram({ topology, onPositionChange, onNodeSelect, onNodeSettings, onNodeLinkStart, onNodeRemove,
  onCanvasAddNode, onCanvasLinkStart, onCanvasSelect, onEdgeSelect, onLabelOffsetChange, selectedNodes = [], selectedConnectionIndex = null,
  unavailableConnectionNodes = [], connectionMode = false }: {
  topology: TopologyFormValues
  onPositionChange?: (key: string, position: Point) => void
  onLabelOffsetChange?: (key: string, offset: Point) => void
  onNodeSelect?: (key: string) => void
  onNodeSettings?: (key: string) => void
  onNodeLinkStart?: (key: string) => void
  onNodeRemove?: (key: string) => void
  onCanvasAddNode?: (kind: AddNodeKind, position: Point) => void
  onCanvasLinkStart?: () => void
  onCanvasSelect?: () => void
  onEdgeSelect?: (index: number) => void
  selectedNodes?: string[]
  selectedConnectionIndex?: number | null
  unavailableConnectionNodes?: string[]
  connectionMode?: boolean
}) {
  const [drag, setDrag] = useState<
    | { kind: "node"; key: string; point: Point; start: Point; moved: boolean }
    | { kind: "label"; key: string; offset: Point; initial: Point; start: Point; moved: boolean }
    | null
  >(null)
  const [context, setContext] = useState<Context | null>(null)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const viewportRef = useRef<HTMLDivElement>(null)
  const W = Math.max(size.width, 680)
  const ignoreClick = useRef(false)
  const clipPrefix = useId().replaceAll(":", "")
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      if (width > 0 && height > 0) setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height })
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!context) return
    const close = () => setContext(null)
    document.addEventListener("click", close)
    document.addEventListener("keydown", close)
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", close) }
  }, [context])
  const { nodes, edges } = useMemo(() => {
    const nodes: DiagramNode[] = topology.Devices.map((d, index) => ({
      key: d.ID,
      label: d.Name || `${t("admin.exTopo.unnamedDevice")} ${index + 1}`,
      kind: d.Type === "unmanaged-switch" || d.Type === "hub" ? "forwarding" : "device",
      icon: topologyIconFor(d, topology.VisualRender),
    }))
    if (topology.VPN.Enabled) nodes.push({ key: "vpn", label: t("admin.exTopo.vpn"), kind: "vpn" })
    if (topology.Internet.Enabled) nodes.push({ key: "internet", label: t("admin.exTopo.internet"), kind: "internet" })

    const known = new Set(nodes.map((n) => n.key))
    const edges: DiagramEdge[] = []
    topology.Connections.forEach((c, i) => {
      const [a, b] = c.Endpoints
      if (!a || !b) return
      const keyA = a.Kind === "device" ? a.DeviceID : a.Kind
      const keyB = b.Kind === "device" ? b.DeviceID : b.Kind
      if (!known.has(keyA) || !known.has(keyB)) return // unresolvable endpoint — skip
      edges.push({ key: `e${i}`, index: i, a: keyA, b: keyB, labelA: a.Interface, labelB: b.Interface })
    })
    return { nodes, edges }
  }, [topology])

  const H = Math.max(size.height, minimumCanvasHeight(nodes, W))
  const pos = useMemo(() => layout(nodes, topology.VisualRender, W, H), [nodes, topology.VisualRender, W, H])
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]))
  if (drag?.kind === "node") pos.set(drag.key, drag.point)

  function pointerPoint(event: PointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return drag?.kind === "node" ? drag.point : { x: W / 2, y: H / 2 }
    return clampPoint({
      x: ((event.clientX - rect.left) / (rect.width || W)) * W,
      y: ((event.clientY - rect.top) / (rect.height || H)) * H,
    }, W, H)
  }

  function commitPosition(key: string, point: Point) {
    onPositionChange?.(key, { x: Number((point.x / W).toFixed(4)), y: Number((point.y / H).toFixed(4)) })
  }

  function commitLabelOffset(key: string, offset: Point) {
    onLabelOffsetChange?.(key, { x: Number(offset.x.toFixed(4)), y: Number(offset.y.toFixed(4)) })
  }

  return (
    <div ref={viewportRef} className="h-full min-w-0 overflow-auto bg-background">
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t("admin.exTopo.diagram")}
      className="block h-full w-full min-w-[680px]"
      style={{ minHeight: H }}
      onContextMenu={(event) => {
        if (!onCanvasAddNode && !onCanvasLinkStart) return
        event.preventDefault()
        const rect = event.currentTarget.getBoundingClientRect()
        const position = clampPoint({
          x: ((event.clientX - rect.left) / (rect.width || W)) * W,
          y: ((event.clientY - rect.top) / (rect.height || H)) * H,
        }, W, H)
        setContext({ kind: "canvas", x: event.clientX, y: event.clientY,
          position: { x: Number((position.x / W).toFixed(4)), y: Number((position.y / H).toFixed(4)) } })
      }}
      onPointerMove={(event) => {
        if (!drag) return
        if (!drag.moved && Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < 5) return
        if (drag.kind === "node") setDrag({ ...drag, point: pointerPoint(event), moved: true })
        else {
          const rect = event.currentTarget.getBoundingClientRect()
          setDrag({ ...drag, offset: {
            x: drag.initial.x + (event.clientX - drag.start.x) / (rect.width || W),
            y: drag.initial.y + (event.clientY - drag.start.y) / (rect.height || H),
          }, moved: true })
        }
      }}
      onPointerUp={() => {
        if (drag?.moved) {
          ignoreClick.current = true
          // A drag may not produce a click on every browser. Never swallow a
          // later, intentional selection if the synthetic click is absent.
          setTimeout(() => { ignoreClick.current = false }, 0)
          if (drag.kind === "node") commitPosition(drag.key, drag.point)
          else commitLabelOffset(drag.key, drag.offset)
        }
        setDrag(null)
      }}
      onPointerCancel={() => setDrag(null)}
    >
      <defs>
        <pattern id={`${clipPrefix}-grid`} width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" className="fill-border/70" /></pattern>
      </defs>
      <rect data-canvas-background width={W} height={H} fill={`url(#${clipPrefix}-grid)`} onClick={onCanvasSelect} />
      {/* Edges — drawn under the nodes */}
      {edges.map((edge) => {
        const nameA = nodeByKey.get(edge.a)?.label ?? edge.a
        const nameB = nodeByKey.get(edge.b)?.label ?? edge.b
        const pa = pos.get(edge.a)!
        const pb = pos.get(edge.b)!
        const start = edgePort(pa, pb, glyphForNode(nodeByKey.get(edge.a)))
        const end = edgePort(pb, pa, glyphForNode(nodeByKey.get(edge.b)))
        const portLabelClass = edges.length > 4 && selectedConnectionIndex !== edge.index
          ? "fill-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          : "fill-foreground"
        return (
          <g key={edge.key} role={onEdgeSelect ? "button" : undefined} tabIndex={onEdgeSelect ? 0 : undefined}
            aria-label={onEdgeSelect ? `${nameA} — ${nameB}` : undefined}
            onClick={() => onEdgeSelect?.(edge.index)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onEdgeSelect?.(edge.index) } }}
            className={onEdgeSelect ? "group cursor-pointer focus:outline-none" : undefined}>
            <title>{`${nameA}: ${edge.labelA || "—"} — ${nameB}: ${edge.labelB || "—"}`}</title>
            {onEdgeSelect && <path data-edge-hit={edge.key} d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
              fill="none" stroke="transparent" strokeWidth={16} pointerEvents="stroke" />}
            <path data-edge={edge.key} d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
              className={selectedConnectionIndex === edge.index ? "fill-none stroke-primary" : "fill-none stroke-muted-foreground/70 group-hover:stroke-primary"}
              strokeWidth={selectedConnectionIndex === edge.index ? 3 : 2} />
            {edge.labelA && (
              <text
                data-port-label
                x={start.x + (end.x - start.x) * 0.17}
                y={start.y + (end.y - start.y) * 0.17 - 9}
                className={portLabelClass}
                fontSize={10}
                textAnchor="middle"
                paintOrder="stroke" stroke="var(--background)" strokeWidth={3}
              >
                {shortForwardingPort(edge.labelA)}
              </text>
            )}
            {edge.labelB && (
              <text
                data-port-label
                x={start.x + (end.x - start.x) * 0.83}
                y={start.y + (end.y - start.y) * 0.83 - 9}
                className={portLabelClass}
                fontSize={10}
                textAnchor="middle"
                paintOrder="stroke" stroke="var(--background)" strokeWidth={3}
              >
                {shortForwardingPort(edge.labelB)}
              </text>
            )}
          </g>
        )
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const p = pos.get(node.key)!
        const glyph = glyphForNode(node)
        const glyphBounds = GLYPH_BOUNDS[glyph]
        const offset = drag?.kind === "label" && drag.key === node.key
          ? drag.offset : storedLabelOffset(topology.VisualRender, node.key)
        const labelX = p.x + offset.x * W
        const labelY = p.y + ICON_SIZE / 2 + LABEL_GAP + offset.y * H
        return (
          <g key={node.key} data-testid={`node-${node.key}`}
            role={onPositionChange || onNodeSelect ? "button" : undefined}
            aria-label={onPositionChange || onNodeSelect ? node.label : undefined}
            aria-disabled={connectionMode && unavailableConnectionNodes.includes(node.key) ? true : undefined}
            aria-description={connectionMode && unavailableConnectionNodes.includes(node.key) ? t("admin.exTopo.noFreePort") : undefined}
            tabIndex={onPositionChange || onNodeSelect ? 0 : undefined}
            className={`group focus:outline-none ${connectionMode && unavailableConnectionNodes.includes(node.key) ? "opacity-45 cursor-not-allowed" : onPositionChange ? "cursor-grab touch-none" : onNodeSelect || onNodeSettings ? "cursor-pointer" : ""}`}
            onPointerDown={(event) => {
              if (!onPositionChange || event.button !== 0) return
              const point = pos.get(node.key)!
              setDrag({ kind: "node", key: node.key, point, start: { x: event.clientX, y: event.clientY }, moved: false })
              // Capture on this node, not the SVG root: otherwise the browser
              // retargets the subsequent click to the canvas and selection fails.
              event.currentTarget.setPointerCapture?.(event.pointerId)
            }}
            onClick={() => {
              if (ignoreClick.current) { ignoreClick.current = false; return }
              if (connectionMode && unavailableConnectionNodes.includes(node.key)) return
              onNodeSelect?.(node.key)
            }}
            onContextMenu={(event) => {
              if (!onNodeSettings && !onNodeLinkStart && !onNodeRemove) return
              event.preventDefault()
              event.stopPropagation()
              setContext({ kind: "node", key: node.key, x: event.clientX, y: event.clientY })
            }}
            onDoubleClick={() => onNodeSettings?.(node.key)}
            onKeyDown={(event) => {
              if ((onNodeSettings || onNodeLinkStart || onNodeRemove) && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                setContext({ kind: "node", key: node.key, x: rect.left, y: rect.bottom })
                return
              }
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (!connectionMode || !unavailableConnectionNodes.includes(node.key)) onNodeSelect?.(node.key); return }
              if (!onPositionChange) return
              const delta = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[event.key]
              if (!delta) return
              event.preventDefault()
              commitPosition(node.key, clampPoint({ x: p.x + delta[0], y: p.y + delta[1] }, W, H))
            }}>
            <title>{node.label}</title>
            <TopologyGlyph kind={glyph} x={p.x - GLYPH_SIZE / 2} y={p.y - GLYPH_SIZE / 2} width={GLYPH_SIZE} height={GLYPH_SIZE} className="text-foreground" />
            <rect data-icon-hitbox x={p.x - ICON_SIZE / 2} y={p.y - ICON_SIZE / 2} width={ICON_SIZE} height={ICON_SIZE}
              fill="transparent" className="stroke-transparent" />
            {glyphBounds.radius
              ? <circle data-selection-outline cx={p.x} cy={p.y} r={glyphBounds.radius + 2} fill="none" strokeWidth={1.5}
                  pointerEvents="none" className={selectedNodes.includes(node.key) ? "stroke-primary" : "stroke-transparent group-hover:stroke-primary/60 group-focus-visible:stroke-primary"} />
              : <rect data-selection-outline x={p.x - glyphBounds.halfX - 2} y={p.y - glyphBounds.halfY - 2}
                  width={(glyphBounds.halfX + 2) * 2} height={(glyphBounds.halfY + 2) * 2} rx={3} fill="none" strokeWidth={1.5}
                  pointerEvents="none" className={selectedNodes.includes(node.key) ? "stroke-primary" : "stroke-transparent group-hover:stroke-primary/60 group-focus-visible:stroke-primary"} />}
            <text
              data-node-label
              x={labelX}
              y={labelY}
              className={`fill-foreground ${onLabelOffsetChange ? "cursor-move touch-none" : ""}`}
              fontSize={12}
              fontWeight={500}
              textAnchor="middle"
              paintOrder="stroke" stroke="var(--background)" strokeWidth={4}
              role={onLabelOffsetChange ? "button" : undefined}
              tabIndex={onLabelOffsetChange ? 0 : undefined}
              aria-label={onLabelOffsetChange ? `${t("admin.exTopo.moveLabel")}: ${node.label}` : undefined}
              onPointerDown={(event) => {
                if (!onLabelOffsetChange || event.button !== 0) return
                event.stopPropagation()
                const initial = storedLabelOffset(topology.VisualRender, node.key)
                setDrag({ kind: "label", key: node.key, initial, offset: initial,
                  start: { x: event.clientX, y: event.clientY }, moved: false })
                event.currentTarget.setPointerCapture?.(event.pointerId)
              }}
              onKeyDown={(event) => {
                if (!onLabelOffsetChange) return
                const delta = { ArrowLeft: [-12 / W, 0], ArrowRight: [12 / W, 0], ArrowUp: [0, -12 / H], ArrowDown: [0, 12 / H] }[event.key]
                if (!delta) return
                event.preventDefault()
                event.stopPropagation()
                commitLabelOffset(node.key, { x: offset.x + delta[0], y: offset.y + delta[1] })
              }}
            >
              {node.label.length > 20 ? `${node.label.slice(0, 19)}…` : node.label}
            </text>
          </g>
        )
      })}
    </svg>
    {context && <div role="menu" aria-label={t(context.kind === "node" ? "admin.exTopo.deviceSettings" : "admin.exTopo.diagram")}
      className="fixed z-50 max-h-[calc(100dvh-1rem)] min-w-32 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
      style={{ left: Math.max(8, Math.min(context.x, window.innerWidth - 190)), top: Math.max(8, Math.min(context.y, window.innerHeight - 230)) }}>
      {context.kind === "node" ? <>
        {onNodeSettings && <button type="button" role="menuitem" autoFocus className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
          onClick={() => { onNodeSettings(context.key); setContext(null) }}>{t("admin.exTopo.configure")}</button>}
        {onNodeLinkStart && <button type="button" role="menuitem" disabled={unavailableConnectionNodes.includes(context.key)}
          title={unavailableConnectionNodes.includes(context.key) ? t("admin.exTopo.noFreePort") : undefined}
          className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => { onNodeLinkStart(context.key); setContext(null) }}>{t("admin.exTopo.addConnection")}</button>}
        {onNodeRemove && <button type="button" role="menuitem" className="block w-full rounded-sm px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-none"
          onClick={() => { onNodeRemove(context.key); setContext(null) }}>{t("admin.exTopo.removeDevice")}</button>}
      </> : <>
        {onCanvasAddNode && ([
          ["container", "admin.exTopo.type.container"], ["unmanaged-switch", "admin.exTopo.type.switch"],
          ["hub", "admin.exTopo.type.hub"], ["vpn", "admin.exTopo.vpn"], ["internet", "admin.exTopo.internet"],
        ] as const).map(([kind, label]) => <button key={kind} type="button" role="menuitem"
          disabled={(kind === "vpn" && topology.VPN.Enabled) || (kind === "internet" && topology.Internet.Enabled)}
          className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none disabled:opacity-40"
          onClick={() => { onCanvasAddNode(kind, context.position); setContext(null) }}>{t(label)}</button>)}
        {onCanvasLinkStart && <button type="button" role="menuitem" className="block w-full rounded-sm border-t border-border px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
          onClick={() => { onCanvasLinkStart(); setContext(null) }}>{t("admin.exTopo.addConnection")}</button>}
      </>}
    </div>}
    </div>
  )
}
