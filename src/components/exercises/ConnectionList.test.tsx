/**
 * ConnectionList.test.tsx — endpoint options from topology, endpoint encoding.
 */
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm, FormProvider, useFormContext, useWatch } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { ConnectionList, encodeEndpoint, decodeEndpoint } from './ConnectionList'
import { TopologyConnectionDialog } from './TopologyConnectionDialog'
import { emptyDraft, emptyDevice, type DraftFormValues } from '@/lib/exerciseSchemas'

describe('encode/decodeEndpoint', () => {
  it('vpn/internet encode as-is', () => {
    expect(encodeEndpoint({ Kind: 'vpn', DeviceID: '', Interface: '' })).toBe('vpn')
    expect(decodeEndpoint('internet')).toEqual({ Kind: 'internet', DeviceID: '', Interface: 'eth0' })
  })

  it('device encodes as device:<id>:<iface> (iface may be empty)', () => {
    expect(encodeEndpoint({ Kind: 'device', DeviceID: 'd1', Interface: 'eth0' })).toBe('device:d1:eth0')
    expect(decodeEndpoint('device:d1:eth0')).toEqual({ Kind: 'device', DeviceID: 'd1', Interface: 'eth0' })
    expect(decodeEndpoint('device:sw1:')).toEqual({ Kind: 'device', DeviceID: 'sw1', Interface: '' })
  })
})

function Snapshot() {
  const { control } = useFormContext<DraftFormValues>()
  const links = useWatch({ control, name: 'Variants.0.Topology.Connections' })
  return <output data-testid="links">{JSON.stringify(links)}</output>
}

function Harness({ existingVPN = true, usedSwitch = false, canvasPair = false }: { existingVPN?: boolean; usedSwitch?: boolean; canvasPair?: boolean } = {}) {
  const [draft] = useState(() => {
    const initial = emptyDraft()
    const web = emptyDevice()
    web.Name = 'web' // container with eth0
    const sw = emptyDevice()
    sw.Name = 'sw1'
    sw.Type = 'unmanaged-switch'
    sw.Interfaces = []
    initial.Variants[0].Topology.Devices = [web, sw]
    initial.Variants[0].Topology.VPN.Enabled = true
    initial.Variants[0].Topology.Connections = existingVPN ? [{
      Endpoints: [
        { Kind: 'vpn', DeviceID: '', Interface: '' },
        { Kind: 'device', DeviceID: web.ID, Interface: 'eth0' },
      ],
    }] : []
    if (usedSwitch) initial.Variants[0].Topology.Connections.push({ Endpoints: [
      { Kind: 'device', DeviceID: sw.ID, Interface: 'GigabitEthernet0/1' },
      { Kind: 'device', DeviceID: web.ID, Interface: 'eth0' },
    ] })
    return initial
  })
  const form = useForm<DraftFormValues>({ defaultValues: draft })
  const webID = draft.Variants[0].Topology.Devices[0].ID
  return (
    <FormProvider {...form}>
      <ConnectionList variantIndex={0} disabled={false} />
      {canvasPair && <TopologyConnectionDialog variantIndex={0} pair={['vpn', webID]} onClose={() => {}}
        onAdd={(first, second) => form.setValue('Variants.0.Topology.Connections', [
          ...form.getValues('Variants.0.Topology.Connections'), { Endpoints: [first, second] },
        ])} />}
      <Snapshot />
    </FormProvider>
  )
}

describe('ConnectionList', () => {
  it('renders the connection and the add button', () => {
    render(<Harness />)
    expect(screen.getByText('admin.exTopo.connections')).toBeInTheDocument()
    // selected endpoint values are visible in the select triggers
    expect(screen.getByText('admin.exTopo.endpoint.vpn · eth0')).toBeInTheDocument()
    expect(screen.getByText('web · eth0')).toBeInTheDocument()
  })

  it('adds an empty connection', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('admin.exTopo.addConnection'))
    expect(screen.getAllByText('admin.exTopo.endpoint.placeholder').length).toBeGreaterThan(0)
  })

  it('does not offer an already-connected VPN or a disabled Internet gateway', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('admin.exTopo.addConnection'))
    fireEvent.keyDown(screen.getAllByRole('button', { name: 'admin.exTopo.endpoint.first' })[1], { key: 'ArrowDown' })
    expect(screen.queryByRole('menuitemradio', { name: 'admin.exTopo.endpoint.vpn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitemradio', { name: 'admin.exTopo.endpoint.internet' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitemradio', { name: 'web · eth0' })).not.toBeInTheDocument()
  })

  it('offers an enabled VPN when it is not connected yet', () => {
    render(<Harness existingVPN={false} />)
    fireEvent.click(screen.getByText('admin.exTopo.addConnection'))
    fireEvent.keyDown(screen.getByRole('button', { name: 'admin.exTopo.endpoint.first' }), { key: 'ArrowDown' })
    expect(screen.getByRole('menuitemradio', { name: 'admin.exTopo.endpoint.vpn · eth0' })).toBeInTheDocument()
  })

  it('keeps the gateway port selectable in the row already using it', () => {
    render(<Harness />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'admin.exTopo.endpoint.first' }), { key: 'ArrowDown' })
    expect(screen.getByRole('menuitemradio', { name: 'admin.exTopo.endpoint.vpn · eth0' })).toBeInTheDocument()
  })

  it('adds a canvas gateway link with eth0 only after confirmation', () => {
    render(<Harness existingVPN={false} canvasPair />)
    expect(JSON.parse(screen.getByTestId('links').textContent ?? '[]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.canvasConnect' }))
    const links = JSON.parse(screen.getByTestId('links').textContent ?? '[]')
    expect(links).toHaveLength(1)
    expect(links[0].Endpoints[0]).toEqual({ Kind: 'vpn', DeviceID: '', Interface: 'eth0' })
  })

  it('lists free switch ports by short label and keeps occupied ports out of new rows', () => {
    render(<Harness existingVPN={false} usedSwitch />)
    fireEvent.click(screen.getByText('admin.exTopo.addConnection'))
    const firstSelectors = screen.getAllByRole('button', { name: 'admin.exTopo.endpoint.first' })
    fireEvent.keyDown(firstSelectors[1], { key: 'ArrowDown' })
    expect(screen.queryByRole('menuitemradio', { name: 'sw1 · Gi0/1' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'sw1 · Gi0/2' })).toBeInTheDocument()
  })
})
