/**
 * TopologyDiagram.test.tsx — nodes and edges derived from a topology snapshot.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { TopologyDiagram } from './TopologyDiagram'
import type { TopologyFormValues } from '@/lib/exerciseSchemas'

const topology: TopologyFormValues = {
  VPN: { Enabled: true, DHCP: true },
  Internet: { Enabled: false, DHCP: false },
  Devices: [
    {
      ID: 'd1', Name: 'web', Type: 'container', Image: 'nginx',
      Interfaces: [{ Name: 'eth0', MAC: '', IP: { Type: 'dhcp', Addresses: [], Gateway: '' } }],
      EnvVars: [], External: { Enabled: false, Port: 80, Protocol: 'http' },
    },
    {
      ID: 'd2', Name: 'sw1', Type: 'unmanaged-switch', Image: '',
      Interfaces: [], EnvVars: [], External: { Enabled: false, Port: 80, Protocol: 'http' },
    },
  ],
  Connections: [
    { Endpoints: [{ Kind: 'device', DeviceID: 'd1', Interface: 'eth0' }, { Kind: 'device', DeviceID: 'd2', Interface: '' }] },
    { Endpoints: [{ Kind: 'vpn', DeviceID: '', Interface: '' }, { Kind: 'device', DeviceID: 'd2', Interface: '' }] },
  ],
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
    }
    const { container } = render(<TopologyDiagram topology={empty} />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelectorAll('line')).toHaveLength(0)
  })
})
