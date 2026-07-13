"use client"

import { useMemo } from "react"
import { t } from "@/i18n/t"
import type { TopologyFormValues } from "@/lib/exerciseSchemas"

/**
 * TopologyDiagram — read-only SVG schema of a variant's topology.
 *
 * Form values are the source of truth: the component is pure, values arrive
 * from the parent's useWatch. Layout is deterministic: every node is placed
 * evenly around a circle in declaration order (devices, then VPN/Internet
 * badges). No external libraries. VisualRender is not consumed (reserved for
 * a future canvas editor).
 */

type NodeKind = "device" | "forwarding" | "vpn" | "internet"
type DiagramNode = { key: string; label: string; kind: NodeKind }
type DiagramEdge = { key: string; a: string; b: string; labelA: string; labelB: string }

const W = 480
const H = 360
const CX = W / 2
const CY = H / 2
const R = Math.min(W, H) / 2 - 52

function layout(nodes: DiagramNode[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>()
  const n = nodes.length
  nodes.forEach((node, i) => {
    if (n === 1) {
      pos.set(node.key, { x: CX, y: CY })
      return
    }
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    pos.set(node.key, { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) })
  })
  return pos
}

export function TopologyDiagram({ topology }: { topology: TopologyFormValues }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: DiagramNode[] = topology.Devices.map((d) => ({
      key: d.ID,
      label: d.Name || "?",
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

  const pos = useMemo(() => layout(nodes), [nodes])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t("admin.exTopo.diagram")}
      className="w-full max-w-xl rounded-md border border-border bg-background"
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
          <g key={node.key} data-testid={`node-${node.key}`}>
            {node.kind === "forwarding" ? (
              <rect
                x={p.x - 14} y={p.y - 14} width={28} height={28} rx={3}
                className="fill-secondary stroke-border"
                strokeWidth={1.5}
              />
            ) : node.kind === "vpn" || node.kind === "internet" ? (
              <rect
                x={p.x - 28} y={p.y - 12} width={56} height={24} rx={12}
                className={
                  node.kind === "vpn"
                    ? "fill-primary/20 stroke-primary"
                    : "fill-accent/30 stroke-foreground/50"
                }
                strokeWidth={1.5}
              />
            ) : (
              <circle
                cx={p.x} cy={p.y} r={16}
                className="fill-card stroke-primary"
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
