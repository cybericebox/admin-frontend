"use client"

import { useMemo, useRef, useState, type PointerEvent } from "react"
import { t } from "@/i18n/t"
import type { TopologyFormValues } from "@/lib/exerciseSchemas"

/**
 * TopologyDiagram — topology canvas. Positions are stored in VisualRender while
 * the device/connection form remains the authoritative topology model.
 *
 * Form values are the source of truth: the component is pure, values arrive
 * from the parent's useWatch. Layout is deterministic: every node is placed
 * evenly around a circle until an editor moves them. No external libraries.
 */

type NodeKind = "device" | "forwarding" | "vpn" | "internet"
type DiagramNode = { key: string; label: string; kind: NodeKind }
type DiagramEdge = { key: string; a: string; b: string; labelA: string; labelB: string }
type Point = { x: number; y: number }

const W = 480
const H = 360
const CX = W / 2
const CY = H / 2
const R = Math.min(W, H) / 2 - 52

function storedPosition(visual: Record<string, unknown> | null, key: string): Point | null {
  const positions = visual?.positions
  if (!positions || typeof positions !== "object" || Array.isArray(positions)) return null
  const candidate = (positions as Record<string, unknown>)[key]
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null
  const { x, y } = candidate as Record<string, unknown>
  return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1 && typeof y === "number" && Number.isFinite(y) && y >= 0 && y <= 1
    ? { x: x * W, y: y * H } : null
}

function layout(nodes: DiagramNode[], visual: Record<string, unknown> | null): Map<string, Point> {
  const pos = new Map<string, Point>()
  const n = nodes.length
  nodes.forEach((node, i) => {
    if (n === 1) {
      pos.set(node.key, storedPosition(visual, node.key) ?? { x: CX, y: CY })
      return
    }
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    pos.set(node.key, storedPosition(visual, node.key) ?? { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) })
  })
  return pos
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
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return drag?.point ?? { x: CX, y: CY }
    return {
      x: Math.max(32, Math.min(W - 32, ((event.clientX - rect.left) / (rect.width || W)) * W)),
      y: Math.max(28, Math.min(H - 28, ((event.clientY - rect.top) / (rect.height || H)) * H)),
    }
  }

  function commitPosition(key: string, point: Point) {
    onPositionChange?.(key, { x: Number((point.x / W).toFixed(4)), y: Number((point.y / H).toFixed(4)) })
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t("admin.exTopo.diagram")}
      className={onPositionChange ? "w-full max-w-2xl rounded-md border border-border bg-background" : "w-full max-w-xl rounded-md border border-border bg-background"}
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
      {/* Edges — drawn under the nodes */}
      {edges.map((edge) => {
        const pa = pos.get(edge.a)!
        const pb = pos.get(edge.b)!
        return (
          <g key={edge.key}>
            <line
              x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              className="stroke-muted-foreground/70"
              strokeWidth={1.5}
            />
            {edge.labelA && (
              <text
                x={pa.x + (pb.x - pa.x) * 0.25}
                y={pa.y + (pb.y - pa.y) * 0.25 - 4}
                className="fill-muted-foreground"
                fontSize={9}
                textAnchor="middle"
              >
                {edge.labelA}
              </text>
            )}
            {edge.labelB && (
              <text
                x={pa.x + (pb.x - pa.x) * 0.75}
                y={pa.y + (pb.y - pa.y) * 0.75 - 4}
                className="fill-muted-foreground"
                fontSize={9}
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
              commitPosition(node.key, { x: Math.max(32, Math.min(W - 32, p.x + delta[0])), y: Math.max(28, Math.min(H - 28, p.y + delta[1])) })
            }}>
            {node.kind === "forwarding" ? (
              <rect
                x={p.x - 14} y={p.y - 14} width={28} height={28} rx={3}
                className={selectedNodes.includes(node.key) ? "fill-primary/20 stroke-primary" : "fill-secondary stroke-border"}
                strokeWidth={1.5}
              />
            ) : node.kind === "vpn" || node.kind === "internet" ? (
              <rect
                x={p.x - 28} y={p.y - 12} width={56} height={24} rx={12}
                className={
                  selectedNodes.includes(node.key)
                    ? "fill-primary/20 stroke-primary"
                    : node.kind === "vpn"
                      ? "fill-primary/20 stroke-primary"
                      : "fill-accent/30 stroke-foreground/50"
                }
                strokeWidth={1.5}
              />
            ) : (
              <circle
                cx={p.x} cy={p.y} r={16}
                className={selectedNodes.includes(node.key) ? "fill-primary/20 stroke-primary" : "fill-card stroke-primary"}
                strokeWidth={1.5}
              />
            )}
            <text
              x={p.x}
              y={node.kind === "vpn" || node.kind === "internet" ? p.y + 4 : p.y + 30}
              className="fill-foreground"
              fontSize={11}
              textAnchor="middle"
            >
              {node.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
