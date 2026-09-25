/**
 * TopologyDiagram.test.tsx — nodes and edges derived from a topology snapshot.
 */
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { TopologyDiagram } from './TopologyDiagram'
import type { TopologyFormValues } from '@/lib/exerciseSchemas'

const topology: TopologyFormValues = {
  VPN: { Enabled: true, DHCP: true },
  Internet: { Enabled: false, DHCP: false },
  Devices: [
    {
      ID: 'd1', Name: 'web', Type: 'container', SecurityPreset: '', Image: 'nginx',
      Resources: { CPURequest: '', MemoryRequest: '', CPULimit: '', MemoryLimit: '' },
      Interfaces: [{ Name: 'eth0', MAC: '', IP: { Type: 'dhcp', Addresses: [], Gateway: '', Routes: [] } }],
      EnvVars: [], External: { Enabled: false, Port: 80, Protocol: 'http' },
    },
    {
      ID: 'd2', Name: 'sw1', Type: 'unmanaged-switch', SecurityPreset: '', Image: '',
      Resources: { CPURequest: '', MemoryRequest: '', CPULimit: '', MemoryLimit: '' },
      Interfaces: [], EnvVars: [], External: { Enabled: false, Port: 80, Protocol: 'http' },
    },
  ],
  Connections: [
    { Endpoints: [{ Kind: 'device', DeviceID: 'd1', Interface: 'eth0' }, { Kind: 'device', DeviceID: 'd2', Interface: 'GigabitEthernet0/1' }] },
    { Endpoints: [{ Kind: 'vpn', DeviceID: '', Interface: 'eth0' }, { Kind: 'device', DeviceID: 'd2', Interface: 'GigabitEthernet0/2' }] },
  ],
  VisualRender: null,
}

describe('TopologyDiagram', () => {
  it('fits the whole board to its available height rather than clipping lower nodes', () => {
    const { container } = render(<TopologyDiagram topology={topology} />)
    const svg = container.querySelector('svg[role="img"]')!
    expect(svg).toHaveClass('h-full')
    expect(svg.parentElement).toHaveClass('h-full')
  })

  it('keeps pictograms at a fixed visual size when the canvas becomes full screen', () => {
    let onResize: ResizeObserverCallback | undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { onResize = callback }
      observe() {}
      disconnect() {}
    })
    try {
      const { container } = render(<TopologyDiagram topology={topology} />)
      const svg = container.querySelector('svg[role="img"]')!
      act(() => onResize?.([{ contentRect: { width: 1440, height: 800 } } as ResizeObserverEntry], {} as ResizeObserver))
      expect(svg).toHaveAttribute('viewBox', '0 0 1440 800')
      expect(container.querySelector('[data-testid="node-d1"] [data-icon-hitbox]')).toHaveAttribute('width', '56')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('grows its inner board and keeps every auto-placed node distinct in a dense topology', () => {
    const devices = Array.from({ length: 30 }, (_, index) => ({
      ...topology.Devices[0], ID: `host-${index + 1}`, Name: `host-${index + 1}`,
    }))
    const { container } = render(<TopologyDiagram topology={{ ...topology, VPN: { Enabled: false, DHCP: false }, Devices: devices, Connections: [], VisualRender: null }} />)
    const svg = container.querySelector('svg[role="img"]')!
    const [, , width, height] = svg.getAttribute('viewBox')!.split(' ').map(Number)
    const points = Array.from(container.querySelectorAll('[data-icon-hitbox]')).map((rect) =>
      `${rect.getAttribute('x')},${rect.getAttribute('y')}`)
    expect(Number(height)).toBeGreaterThan(560)
    expect(Number(width)).toBe(960)
    expect(new Set(points).size).toBe(30)
    expect(svg.parentElement).toHaveClass('overflow-auto')
  })

  it('does not reserve empty gateway rows above a standalone forwarding device', () => {
    const { container } = render(<TopologyDiagram topology={{ ...topology, VPN: { Enabled: false, DHCP: false }, Connections: [] }} />)
    const switchY = Number(container.querySelector('[data-testid="node-d2"] [data-icon-hitbox]')?.getAttribute('y'))
    const hostY = Number(container.querySelector('[data-testid="node-d1"] [data-icon-hitbox]')?.getAttribute('y'))
    expect(switchY).toBeLessThan(180)
    expect(hostY).toBeGreaterThan(switchY)
  })

  it('starts a hosts-only topology in the first available row', () => {
    const { container } = render(<TopologyDiagram topology={{ ...topology, VPN: { Enabled: false, DHCP: false }, Devices: [topology.Devices[0]], Connections: [] }} />)
    const hostY = Number(container.querySelector('[data-testid="node-d1"] [data-icon-hitbox]')?.getAttribute('y'))
    expect(hostY).toBeLessThan(180)
  })

  it('uses distinct custom vector pictograms instead of bitmap images', () => {
    const { container } = render(<TopologyDiagram topology={topology} />)
    expect(container.querySelectorAll('[data-testid^="node-"] image')).toHaveLength(0)
    const glyphs = ['d1', 'd2', 'vpn'].map((key) => container.querySelector(`[data-testid="node-${key}"] [data-topology-glyph]`))
    expect(glyphs.every(Boolean)).toBe(true)
    expect(new Set(glyphs.map((glyph) => glyph?.getAttribute('data-topology-glyph'))).size).toBe(3)
  })

  it('moves a label independently and preserves its offset relative to the node', () => {
    const onLabelOffsetChange = vi.fn()
    const onPositionChange = vi.fn()
    const { container } = render(<TopologyDiagram topology={topology} onLabelOffsetChange={onLabelOffsetChange} onPositionChange={onPositionChange} />)
    const svg = container.querySelector('svg')!
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 960, height: 560 } as DOMRect)
    const label = container.querySelector('[data-testid="node-d1"] [data-node-label]')!
    const startX = Number(label.getAttribute('x'))
    const startY = Number(label.getAttribute('y'))
    fireEvent(label, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: startX, clientY: startY }))
    fireEvent(svg, new MouseEvent('pointermove', { bubbles: true, clientX: startX + 35, clientY: startY - 20 }))
    fireEvent(svg, new MouseEvent('pointerup', { bubbles: true, clientX: startX + 35, clientY: startY - 20 }))
    expect(onLabelOffsetChange).toHaveBeenCalledWith('d1', expect.any(Object))
    expect(onLabelOffsetChange.mock.calls[0][1].x).toBeCloseTo(35 / 960, 3)
    expect(onLabelOffsetChange.mock.calls[0][1].y).toBeCloseTo(-20 / 560, 3)
    expect(onPositionChange).not.toHaveBeenCalled()
  })

  it('renders a node per device plus enabled networks', () => {
    render(<TopologyDiagram topology={topology} />)
    expect(screen.getByText('web', { selector: 'text' })).toBeInTheDocument()
    expect(screen.getByText('sw1', { selector: 'text' })).toBeInTheDocument()
    expect(screen.getByText('admin.exTopo.vpn', { selector: 'text' })).toBeInTheDocument() // VPN enabled
    expect(screen.queryByText('admin.exTopo.internet')).not.toBeInTheDocument() // Internet disabled
  })

  it('identifies connections by visible device names, not internal IDs', () => {
    const { container } = render(<TopologyDiagram topology={topology} onEdgeSelect={vi.fn()} />)
    const edge = container.querySelector('[data-edge="e0"]')!.parentElement!
    expect(edge).toHaveAttribute('aria-label', 'web — sw1')
    expect(edge.querySelector('title')).toHaveTextContent('web: eth0 — sw1: GigabitEthernet0/1')
  })

  it('draws each pictogram directly on the board with a label below, without a white tile', () => {
    const { container } = render(<TopologyDiagram topology={topology} />)
    for (const key of ['d1', 'd2', 'vpn']) {
      const node = container.querySelector(`[data-testid="node-${key}"]`)!
      const hitbox = node.querySelector('rect[data-icon-hitbox]')!
      const picture = node.querySelector('[data-topology-glyph]')!
      const label = node.querySelector('text')!
      expect(hitbox).toHaveAttribute('width', hitbox.getAttribute('height'))
      expect(hitbox).toHaveAttribute('fill', 'transparent')
      expect(picture).toBeInTheDocument()
      expect(Number(label.getAttribute('y'))).toBeGreaterThan(Number(hitbox.getAttribute('y')) + Number(hitbox.getAttribute('height')))
      expect(Array.from(node.children).filter((child) => child.tagName.toLowerCase() === 'rect' && child.getAttribute('fill') !== 'none')).toHaveLength(1)
    }
    expect(container.querySelector('[data-testid="node-d2"] [data-topology-glyph]')).toHaveAttribute('data-topology-glyph', 'switch')
  })

  it('keeps a generous click target but outlines only the visible pictogram', () => {
    const { container } = render(<TopologyDiagram topology={topology} selectedNodes={['d1', 'vpn']} />)
    const host = container.querySelector('[data-testid="node-d1"]')!
    expect(host.querySelector('[data-icon-hitbox]')).toHaveAttribute('width', '56')
    expect(Number(host.querySelector('[data-selection-outline]')?.getAttribute('width'))).toBeLessThan(34)
    expect(host.querySelector('[data-selection-outline]')).toHaveClass('stroke-primary')
    expect(host.querySelector('[data-icon-hitbox]')).toHaveClass('stroke-transparent')
    const internetTopology = { ...topology, Internet: { Enabled: true, DHCP: false } }
    const round = render(<TopologyDiagram topology={internetTopology} selectedNodes={['internet']} />)
    expect(Number(round.container.querySelector('[data-testid="node-internet"] circle[data-selection-outline]')?.getAttribute('r'))).toBeLessThan(19)
  })

  it('uses a visual-only pictogram override without changing the device type', () => {
    const visual = { ...topology, VisualRender: { version: 1, icons: { d1: 'firewall' } } }
    const { container } = render(<TopologyDiagram topology={visual} />)
    expect(container.querySelector('[data-testid="node-d1"] [data-topology-glyph]')).toHaveAttribute('data-topology-glyph', 'firewall')
    expect(container.querySelector('[data-testid="node-d2"] [data-topology-glyph]')).toHaveAttribute('data-topology-glyph', 'switch')
  })

  it('draws a line per resolvable connection and labels interfaces', () => {
    const { container } = render(<TopologyDiagram topology={topology} />)
    expect(container.querySelectorAll('[data-edge]')).toHaveLength(2)
    expect(screen.getAllByText('eth0').length).toBeGreaterThanOrEqual(2)
  })

  it('makes a thin connection easy to select without widening its visible stroke', () => {
    const onEdgeSelect = vi.fn()
    const { container } = render(<TopologyDiagram topology={topology} onEdgeSelect={onEdgeSelect} />)
    const edge = container.querySelector('[data-edge="e0"]')!
    const hitTarget = container.querySelector('[data-edge-hit="e0"]')!
    expect(edge).toHaveAttribute('stroke-width', '2')
    expect(hitTarget).toHaveAttribute('stroke-width', '16')
    expect(hitTarget).toHaveAttribute('stroke', 'transparent')
    fireEvent.click(hitTarget)
    expect(onEdgeSelect).toHaveBeenCalledWith(0)
  })

  it('reveals port names only for the active link when many links converge', () => {
    const devices = [topology.Devices[1], ...Array.from({ length: 6 }, (_, index) => ({
      ...topology.Devices[0], ID: `host-${index}`, Name: `host-${index}`,
    }))]
    const connections = devices.slice(1).map((device, index) => ({ Endpoints: [
      { Kind: 'device' as const, DeviceID: topology.Devices[1].ID, Interface: `GigabitEthernet0/${index + 1}` },
      { Kind: 'device' as const, DeviceID: device.ID, Interface: 'eth0' },
    ] }))
    const { container } = render(<TopologyDiagram topology={{ ...topology, Devices: devices, Connections: connections }} selectedConnectionIndex={0} onEdgeSelect={() => {}} />)
    const activeLabels = container.querySelector('[data-edge="e0"]')?.parentElement?.querySelectorAll('[data-port-label]') ?? []
    const quietLabels = container.querySelector('[data-edge="e1"]')?.parentElement?.querySelectorAll('[data-port-label]') ?? []
    expect(activeLabels).toHaveLength(2)
    expect(quietLabels).toHaveLength(2)
    for (const label of activeLabels) expect(label).not.toHaveClass('opacity-0')
    for (const label of quietLabels) {
      expect(label).toHaveClass('opacity-0')
      expect(label).toHaveClass('group-hover:opacity-100')
      expect(label).toHaveClass('group-focus-visible:opacity-100')
    }
  })

  it('keeps a device name readable when several links pass behind it', () => {
    const { container } = render(<TopologyDiagram topology={topology} />)
    const name = container.querySelector('[data-testid="node-d2"] [data-node-label]')!
    expect(name).toHaveAttribute('paint-order', 'stroke')
    expect(name).toHaveAttribute('stroke-width', '4')
  })

  it('joins the visible glyph boundaries without detached endpoint circles', () => {
    const connected: TopologyFormValues = {
      ...topology,
      Internet: { Enabled: true, DHCP: false },
      Connections: [{ Endpoints: [
        { Kind: 'device', DeviceID: 'd1', Interface: 'eth0' },
        { Kind: 'internet', DeviceID: '', Interface: 'eth0' },
      ] }],
      VisualRender: { version: 1, positions: { d1: { x: 0.2, y: 0.4 }, internet: { x: 0.8, y: 0.4 } } },
    }
    const { container } = render(<TopologyDiagram topology={connected} />)
    expect(container.querySelector('[data-edge="e0"]')).toHaveAttribute('d', 'M 204.67 224 L 752.56 224')
    expect(container.querySelector('[data-edge="e0"]')?.parentElement?.querySelectorAll('circle')).toHaveLength(0)
  })

  it('skips connections with unresolved endpoints', () => {
    const broken: TopologyFormValues = {
      ...topology,
      Connections: [{ Endpoints: [{ Kind: 'device', DeviceID: 'ghost', Interface: '' }, { Kind: 'vpn', DeviceID: '', Interface: 'eth0' }] }],
    }
    const { container } = render(<TopologyDiagram topology={broken} />)
    expect(container.querySelectorAll('[data-edge]')).toHaveLength(0)
  })

  it('renders without crashing for an empty topology', () => {
    const empty: TopologyFormValues = {
      VPN: { Enabled: false, DHCP: false },
      Internet: { Enabled: false, DHCP: false },
      Devices: [],
      Connections: [],
      VisualRender: null,
    }
    const { container } = render(<TopologyDiagram topology={empty} />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelectorAll('[data-edge]')).toHaveLength(0)
  })

  it('uses saved positions and lets an editor move a node with the keyboard', () => {
    const moved = { ...topology, VisualRender: { version: 1, positions: { d1: { x: 0.2, y: 0.4 } } } }
    const onPositionChange = vi.fn()
    const { container } = render(<TopologyDiagram topology={moved} onPositionChange={onPositionChange} />)
    expect(container.querySelector('[data-testid="node-d1"] rect[data-icon-hitbox]')).toHaveAttribute('x', '164')
    fireEvent.keyDown(screen.getByRole('button', { name: 'web' }), { key: 'ArrowRight' })
    expect(onPositionChange).toHaveBeenCalledWith('d1', expect.objectContaining({ x: expect.any(Number), y: 0.4 }))
    expect(onPositionChange.mock.calls[0][1].x).toBeGreaterThan(0.2)
  })

  it('commits a dragged node position in normalized canvas coordinates', () => {
    const onPositionChange = vi.fn()
    const { container } = render(<TopologyDiagram topology={topology} onPositionChange={onPositionChange} />)
    const svg = container.querySelector('svg')!
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 960, height: 560 } as DOMRect)
    fireEvent(screen.getByRole('button', { name: 'web' }), new MouseEvent('pointerdown', { bubbles: true, clientX: 480, clientY: 56 }))
    fireEvent(svg, new MouseEvent('pointermove', { bubbles: true, clientX: 384, clientY: 280 }))
    fireEvent(svg, new MouseEvent('pointerup', { bubbles: true, clientX: 384, clientY: 280 }))
    expect(onPositionChange).toHaveBeenCalledWith('d1', { x: 0.4, y: 0.5 })
  })

  it('captures a pointer on the pressed node so the later click can select it', () => {
    const onNodeSelect = vi.fn()
    const onPositionChange = vi.fn()
    const { container } = render(<TopologyDiagram topology={topology} onNodeSelect={onNodeSelect} onPositionChange={onPositionChange} />)
    const node = container.querySelector('[data-testid="node-d1"]') as SVGGElement
    const svg = container.querySelector('svg')!
    const captureNode = vi.fn()
    const captureCanvas = vi.fn()
    node.setPointerCapture = captureNode
    svg.setPointerCapture = captureCanvas
    fireEvent(node, new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    expect(captureNode).toHaveBeenCalledOnce()
    expect(captureCanvas).not.toHaveBeenCalled()
    fireEvent.pointerUp(node, { pointerId: 4 })
    fireEvent.click(node)
    expect(onNodeSelect).toHaveBeenCalledWith('d1')
  })

  it('still selects the second node after small pointer movement while starting a link', () => {
    const onNodeSelect = vi.fn()
    const onPositionChange = vi.fn()
    const { container } = render(<TopologyDiagram topology={topology} onNodeSelect={onNodeSelect} onPositionChange={onPositionChange} />)
    const node = screen.getByRole('button', { name: 'sw1' })
    const svg = container.querySelector('svg')!
    fireEvent(node, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 400, clientY: 260 }))
    fireEvent(svg, new MouseEvent('pointermove', { bubbles: true, clientX: 402, clientY: 261 }))
    fireEvent(svg, new MouseEvent('pointerup', { bubbles: true, clientX: 402, clientY: 261 }))
    fireEvent.click(node)
    expect(onNodeSelect).toHaveBeenCalledWith('d2')
    expect(onPositionChange).not.toHaveBeenCalled()
  })

  it('offers configuration from the VPN connector context menu', () => {
    const onNodeSettings = vi.fn()
    render(<TopologyDiagram topology={topology} onNodeSettings={onNodeSettings} />)
    fireEvent.contextMenu(screen.getByTestId('node-vpn'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'admin.exTopo.configure' }))
    expect(onNodeSettings).toHaveBeenCalledWith('vpn')
  })

  it('opens a canvas context menu at empty space and starts a link from a node menu', () => {
    const onCanvasAddNode = vi.fn()
    const onNodeLinkStart = vi.fn()
    const { container } = render(<TopologyDiagram topology={topology} onCanvasAddNode={onCanvasAddNode} onNodeLinkStart={onNodeLinkStart} />)
    const svg = container.querySelector('svg')!
    fireEvent.contextMenu(svg, { clientX: 250, clientY: 220 })
    expect(screen.getByRole('menu', { name: 'admin.exTopo.diagram' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'admin.exTopo.type.container' }))
    expect(onCanvasAddNode).toHaveBeenCalledWith('container', expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }))
    fireEvent.contextMenu(screen.getByTestId('node-d1'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'admin.exTopo.addConnection' }))
    expect(onNodeLinkStart).toHaveBeenCalledWith('d1')
  })

  it('uses unique grid patterns across two simultaneous diagrams', () => {
    const { container } = render(<><TopologyDiagram topology={topology} /><TopologyDiagram topology={topology} /></>)
    const patterns = Array.from(container.querySelectorAll('pattern')).map((pattern) => pattern.id)
    expect(patterns).toHaveLength(2)
    expect(new Set(patterns).size).toBe(2)
  })

  it('shows the one-port labels and distinct pictograms for both connector kinds', () => {
    const both = { ...topology, Internet: { Enabled: true, DHCP: false }, Connections: [
      ...topology.Connections,
      { Endpoints: [{ Kind: 'internet' as const, DeviceID: '', Interface: 'eth0' }, { Kind: 'device' as const, DeviceID: 'd1', Interface: 'eth1' }] },
    ] }
    const { container } = render(<TopologyDiagram topology={both} selectedConnectionIndex={2} />)
    expect(container.querySelector('[data-testid="node-vpn"] [data-topology-glyph]')).toHaveAttribute('data-topology-glyph', 'vpn')
    expect(container.querySelector('[data-testid="node-internet"] [data-topology-glyph]')).toHaveAttribute('data-topology-glyph', 'internet')
    expect(container.querySelectorAll('text')).not.toHaveLength(0)
    expect(container.querySelector('[data-edge="e2"]')).toHaveClass('stroke-primary')
    expect(container.querySelector('[data-edge="e2"]')?.parentElement).toHaveTextContent('eth0')
  })
})
