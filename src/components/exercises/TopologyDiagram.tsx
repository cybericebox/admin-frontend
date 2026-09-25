"use client"

import { useMemo, useRef, useState, type PointerEvent } from "react"
import { t } from "@/i18n/t"
import type { TopologyFormValues } from "@/lib/exerciseSchemas"

/**
 * TopologyDiagram — topology canvas. Positions are stored in VisualRender while
 * the device/connection form remains the authoritative topology model.
 *
 * Form values are the source of truth. Automatic positions follow the network
 * reading order (uplinks → forwarding devices → containers); editor positions
 * override them. No external graph library or second topology model.
 */

type NodeKind = "device" | "forwarding" | "vpn" | "internet"
type DiagramNode = { key: string; label: string; kind: NodeKind }
type DiagramEdge = { key: string; a: string; b: string; labelA: string; labelB: string }
type Point = { x: number; y: number }

const W = 960
const H = 560
const MIN_X = 90
const MAX_X = W - MIN_X
const MIN_Y = 58
const MAX_Y = H - 58

function clampPoint(point: Point): Point {
  return { x: Math.max(MIN_X, Math.min(MAX_X, point.x)), y: Math.max(MIN_Y, Math.min(MAX_Y, point.y)) }
}

function storedPosition(visual: Record<string, unknown> | null, key: string): Point | null {
  const positions = visual?.positions
  if (!positions || typeof positions !== "object" || Array.isArray(positions)) return null
  const candidate = (positions as Record<string, unknown>)[key]
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null
  const { x, y } = candidate as Record<string, unknown>
  return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1 && typeof y === "number" && Number.isFinite(y) && y >= 0 && y <= 1
    ? clampPoint({ x: x * W, y: y * H }) : null
}

function layout(nodes: DiagramNode[], visual: Record<string, unknown> | null): Map<string, Point> {
  const pos = new Map<string, Point>()
  const gateways = nodes.filter((node) => node.kind === "vpn" || node.kind === "internet")
  const forwarding = nodes.filter((node) => node.kind === "forwarding")
  const containers = nodes.filter((node) => node.kind === "device")
  const place = (group: DiagramNode[], y: number, rowSize = 5) => group.forEach((node, index) => {
    const row = Math.floor(index / rowSize)
    const count = Math.min(rowSize, group.length - row * rowSize)
    const column = index % rowSize
    const x = ((column + 1) * W) / (count + 1)
    pos.set(node.key, storedPosition(visual, node.key) ?? clampPoint({ x, y: y + row * 105 }))
  })
  place(gateways, 105, 2)
  place(forwarding, 260, 4)
  place(containers, forwarding.length ? 415 : 325, 5)
  return pos
}

function edgePort(from: Point, to: Point, kind: NodeKind): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (!dx && !dy) return from
  const halfWidth = kind === "device" ? 76 : kind === "forwarding" ? 66 : 70
  const halfHeight = kind === "device" ? 34 : kind === "forwarding" ? 30 : 26
  const scale = Math.min(halfWidth / (Math.abs(dx) || 1), halfHeight / (Math.abs(dy) || 1))
  return { x: from.x + dx * scale, y: from.y + dy * scale }
}

export function TopologyDiagram({ topology, onPositionChange, onNodeSelect, selectedNodes = [] }: {
  topology: TopologyFormValues
  onPositionChange?: (key: string, position: Point) => void
  onNodeSelect?: (key: string) => void
  selectedNodes?: string[]
}) {
  const [drag, setDrag] = useState<{ key: string; point: Point; moved: boolean } | null>(null)
  const ignoreClick = useRef(false)
  const { nodes, edges } = useMemo(() => {
    const nodes: DiagramNode[] = topology.Devices.map((d, index) => ({
      key: d.ID,
      label: d.Name || `${t("admin.exTopo.unnamedDevice")} ${index + 1}`,
      kind: d.Type === "unmanaged-switch" || d.Type === "hub" ? "forwarding" : "device",
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
      edges.push({ key: `e${i}`, a: keyA, b: keyB, labelA: a.Interface, labelB: b.Interface })
    })
    return { nodes, edges }
  }, [topology])

  const pos = useMemo(() => layout(nodes, topology.VisualRender), [nodes, topology.VisualRender])
  if (drag) pos.set(drag.key, drag.point)

  function pointerPoint(event: PointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return drag?.point ?? { x: W / 2, y: H / 2 }
    return clampPoint({
      x: ((event.clientX - rect.left) / (rect.width || W)) * W,
      y: ((event.clientY - rect.top) / (rect.height || H)) * H,
    })
  }

  function commitPosition(key: string, point: Point) {
    onPositionChange?.(key, { x: Number((point.x / W).toFixed(4)), y: Number((point.y / H).toFixed(4)) })
  }

  return (
    <div className="min-w-0 overflow-x-auto rounded-md border border-border bg-background">
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t("admin.exTopo.diagram")}
      className="block w-full min-w-[680px]"
      onPointerMove={(event) => {
        if (!drag) return
        setDrag({ key: drag.key, point: pointerPoint(event), moved: true })
      }}
      onPointerUp={() => {
        if (drag?.moved) {
          ignoreClick.current = true
          // A drag may not produce a click on every browser. Never swallow a
          // later, intentional selection if the synthetic click is absent.
          setTimeout(() => { ignoreClick.current = false }, 0)
          commitPosition(drag.key, drag.point)
        }
        setDrag(null)
      }}
      onPointerCancel={() => setDrag(null)}
    >
      <defs><pattern id="topology-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" className="fill-border/70" /></pattern></defs>
      <rect width={W} height={H} fill="url(#topology-grid)" />
      {/* Edges — drawn under the nodes */}
      {edges.map((edge) => {
        const pa = pos.get(edge.a)!
        const pb = pos.get(edge.b)!
        const kindA = nodes.find((node) => node.key === edge.a)!.kind
        const kindB = nodes.find((node) => node.key === edge.b)!.kind
        const start = edgePort(pa, pb, kindA)
        const end = edgePort(pb, pa, kindB)
        return (
          <g key={edge.key}>
            <path data-edge={edge.key} d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`} className="fill-none stroke-muted-foreground/70" strokeWidth={2} />
            <circle cx={start.x} cy={start.y} r={4} className="fill-background stroke-primary" strokeWidth={1.5} />
            <circle cx={end.x} cy={end.y} r={4} className="fill-background stroke-primary" strokeWidth={1.5} />
            {edge.labelA && (
              <text
                x={start.x + (end.x - start.x) * 0.17}
                y={start.y + (end.y - start.y) * 0.17 - 9}
                className="fill-foreground"
                fontSize={11}
                textAnchor="middle"
              >
                {edge.labelA}
              </text>
            )}
            {edge.labelB && (
              <text
                x={start.x + (end.x - start.x) * 0.83}
                y={start.y + (end.y - start.y) * 0.83 - 9}
                className="fill-foreground"
                fontSize={11}
                textAnchor="middle"
              >
                {edge.labelB}
              </text>
            )}
          </g>
        )
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const p = pos.get(node.key)!
        return (
          <g key={node.key} data-testid={`node-${node.key}`}
            role={onPositionChange || onNodeSelect ? "button" : undefined}
            aria-label={onPositionChange || onNodeSelect ? node.label : undefined}
            tabIndex={onPositionChange || onNodeSelect ? 0 : undefined}
            className={onPositionChange ? "cursor-grab touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" : undefined}
            onPointerDown={(event) => {
              if (!onPositionChange) return
              const point = pos.get(node.key)!
              setDrag({ key: node.key, point, moved: false })
              event.currentTarget.ownerSVGElement?.setPointerCapture?.(event.pointerId)
            }}
            onClick={() => {
              if (ignoreClick.current) { ignoreClick.current = false; return }
              onNodeSelect?.(node.key)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onNodeSelect?.(node.key); return }
              if (!onPositionChange) return
              const delta = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[event.key]
              if (!delta) return
              event.preventDefault()
              commitPosition(node.key, clampPoint({ x: p.x + delta[0], y: p.y + delta[1] }))
            }}>
            <title>{node.label}</title>
            {node.kind === "device" && <>
              <rect x={p.x - 76} y={p.y - 34} width={152} height={68} rx={10}
                className={selectedNodes.includes(node.key) ? "fill-primary/10 stroke-primary" : "fill-card stroke-border"} strokeWidth={selectedNodes.includes(node.key) ? 2.5 : 1.5} />
              <rect x={p.x - 76} y={p.y - 34} width={152} height={5} rx={2} className="fill-primary" />
              <rect x={p.x - 61} y={p.y - 10} width={22} height={20} rx={3} className="fill-primary/15 stroke-primary" strokeWidth={1.5} />
              <circle cx={p.x - 55} cy={p.y - 3} r={1.5} className="fill-primary" /><circle cx={p.x - 55} cy={p.y + 3} r={1.5} className="fill-primary" />
            </>}
            {node.kind === "forwarding" && <>
              <rect x={p.x - 66} y={p.y - 30} width={132} height={60} rx={8}
                className={selectedNodes.includes(node.key) ? "fill-primary/10 stroke-primary" : "fill-secondary stroke-border"} strokeWidth={selectedNodes.includes(node.key) ? 2.5 : 1.5} />
              {[-30, -12, 6, 24].map((offset) => <rect key={offset} x={p.x + offset} y={p.y + 13} width={10} height={7} rx={1} className="fill-background stroke-muted-foreground" strokeWidth={1} />)}
            </>}
            {(node.kind === "vpn" || node.kind === "internet") && <rect x={p.x - 70} y={p.y - 26} width={140} height={52} rx={26}
              className={selectedNodes.includes(node.key) ? "fill-primary/15 stroke-primary" : "fill-accent/30 stroke-primary/60"} strokeWidth={selectedNodes.includes(node.key) ? 2.5 : 1.5} />}
            <text
              x={node.kind === "device" ? p.x - 28 : p.x}
              y={node.kind === "forwarding" ? p.y + 2 : p.y + 5}
              className="fill-foreground"
              fontSize={14}
              fontWeight={600}
              textAnchor={node.kind === "device" ? "start" : "middle"}
            >
              {node.label.length > 17 ? `${node.label.slice(0, 16)}…` : node.label}
            </text>
          </g>
        )
      })}
    </svg>
    </div>
  )
}
