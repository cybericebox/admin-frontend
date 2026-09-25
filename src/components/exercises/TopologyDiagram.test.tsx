/**
 * TopologyDiagram.test.tsx — nodes and edges derived from a topology snapshot.
 */
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { TopologyDiagram } from './TopologyDiagram'
import type { TopologyFormValues } from '@/lib/exerciseSchemas'

const topology: TopologyFormValues = {
  VPN: { Enabled: true, DHCP: true },
  Internet: { Enabled: false, DHCP: false },
  Devices: [
    {
      ID: 'd1', Name: 'web', Type: 'container', SecurityPreset: '', Image: 'nginx',
      Interfaces: [{ Name: 'eth0', MAC: '', IP: { Type: 'dhcp', Addresses: [], Gateway: '' } }],
      EnvVars: [], External: { Enabled: false, Port: 80, Protocol: 'http' },
    },
    {
      ID: 'd2', Name: 'sw1', Type: 'unmanaged-switch', SecurityPreset: '', Image: '',
      Interfaces: [], EnvVars: [], External: { Enabled: false, Port: 80, Protocol: 'http' },
    },
  ],
  Connections: [
    { Endpoints: [{ Kind: 'device', DeviceID: 'd1', Interface: 'eth0' }, { Kind: 'device', DeviceID: 'd2', Interface: '' }] },
    { Endpoints: [{ Kind: 'vpn', DeviceID: '', Interface: '' }, { Kind: 'device', DeviceID: 'd2', Interface: '' }] },
  ],
  VisualRender: null,
}

describe('TopologyDiagram', () => {
  it('renders a node per device plus enabled networks', () => {
    render(<TopologyDiagram topology={topology} />)
    expect(screen.getByText('web')).toBeInTheDocument()
    expect(screen.getByText('sw1')).toBeInTheDocument()
    expect(screen.getByText('admin.exTopo.vpn')).toBeInTheDocument() // VPN enabled
    expect(screen.queryByText('admin.exTopo.internet')).not.toBeInTheDocument() // Internet disabled
  })

  it('draws shapes by kind: circle for container, square for switch, pill for vpn', () => {
    const { container } = render(<TopologyDiagram topology={topology} />)
    expect(container.querySelector('[data-testid="node-d1"] circle')).not.toBeNull()
    expect(container.querySelector('[data-testid="node-d2"] rect')).not.toBeNull()
    expect(container.querySelector('[data-testid="node-vpn"] rect')).not.toBeNull()
  })

  it('draws a line per resolvable connection and labels interfaces', () => {
    const { container } = render(<TopologyDiagram topology={topology} />)
    expect(container.querySelectorAll('line')).toHaveLength(2)
    expect(screen.getByText('eth0')).toBeInTheDocument()
  })

  it('skips connections with unresolved endpoints', () => {
    const broken: TopologyFormValues = {
      ...topology,
      Connections: [{ Endpoints: [{ Kind: 'device', DeviceID: 'ghost', Interface: '' }, { Kind: 'vpn', DeviceID: '', Interface: '' }] }],
    }
    const { container } = render(<TopologyDiagram topology={broken} />)
    expect(container.querySelectorAll('line')).toHaveLength(0)
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
    expect(container.querySelectorAll('line')).toHaveLength(0)
  })

  it('uses saved positions and lets an editor move a node with the keyboard', () => {
    const moved = { ...topology, VisualRender: { version: 1, positions: { d1: { x: 0.2, y: 0.4 } } } }
    const onPositionChange = vi.fn()
    const { container } = render(<TopologyDiagram topology={moved} onPositionChange={onPositionChange} />)
    expect(container.querySelector('[data-testid="node-d1"] circle')).toHaveAttribute('cx', '96')
    fireEvent.keyDown(screen.getByRole('button', { name: 'web' }), { key: 'ArrowRight' })
    expect(onPositionChange).toHaveBeenCalledWith('d1', expect.objectContaining({ x: expect.any(Number), y: 0.4 }))
    expect(onPositionChange.mock.calls[0][1].x).toBeGreaterThan(0.2)
  })

  it('commits a dragged node position in normalized canvas coordinates', () => {
    const onPositionChange = vi.fn()
    const { container } = render(<TopologyDiagram topology={topology} onPositionChange={onPositionChange} />)
    const svg = container.querySelector('svg')!
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 480, height: 360 } as DOMRect)
    fireEvent(screen.getByRole('button', { name: 'web' }), new MouseEvent('pointerdown', { bubbles: true, clientX: 240, clientY: 36 }))
    fireEvent(svg, new MouseEvent('pointermove', { bubbles: true, clientX: 192, clientY: 180 }))
    fireEvent(svg, new MouseEvent('pointerup', { bubbles: true, clientX: 192, clientY: 180 }))
    expect(onPositionChange).toHaveBeenCalledWith('d1', { x: 0.4, y: 0.5 })
  })
})
