/**
 * ConnectionList.test.tsx — endpoint options from topology, endpoint encoding.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { ConnectionList, encodeEndpoint, decodeEndpoint } from './ConnectionList'
import { emptyDraft, emptyDevice, type DraftFormValues } from '@/lib/exerciseSchemas'

describe('encode/decodeEndpoint', () => {
  it('vpn/internet encode as-is', () => {
    expect(encodeEndpoint({ Kind: 'vpn', DeviceID: '', Interface: '' })).toBe('vpn')
    expect(decodeEndpoint('internet')).toEqual({ Kind: 'internet', DeviceID: '', Interface: '' })
  })

  it('device encodes as device:<id>:<iface> (iface may be empty)', () => {
    expect(encodeEndpoint({ Kind: 'device', DeviceID: 'd1', Interface: 'eth0' })).toBe('device:d1:eth0')
    expect(decodeEndpoint('device:d1:eth0')).toEqual({ Kind: 'device', DeviceID: 'd1', Interface: 'eth0' })
    expect(decodeEndpoint('device:sw1:')).toEqual({ Kind: 'device', DeviceID: 'sw1', Interface: '' })
  })
})

function Harness() {
  const draft = emptyDraft()
  const web = emptyDevice()
  web.Name = 'web' // container with eth0
  const sw = emptyDevice()
  sw.Name = 'sw1'
  sw.Type = 'unmanaged-switch'
  sw.Interfaces = []
  draft.Variants[0].Topology.Devices = [web, sw]
  draft.Variants[0].Topology.Connections = [{
    Endpoints: [
      { Kind: 'vpn', DeviceID: '', Interface: '' },
      { Kind: 'device', DeviceID: web.ID, Interface: 'eth0' },
    ],
  }]
  const form = useForm<DraftFormValues>({ defaultValues: draft })
  return (
    <FormProvider {...form}>
      <ConnectionList variantIndex={0} disabled={false} />
    </FormProvider>
  )
}

describe('ConnectionList', () => {
  it('renders the connection and the add button', () => {
    render(<Harness />)
    expect(screen.getByText('admin.exTopo.connections')).toBeInTheDocument()
    // selected endpoint values are visible in the select triggers
    expect(screen.getByText('admin.exTopo.endpoint.vpn')).toBeInTheDocument()
    expect(screen.getByText('web · eth0')).toBeInTheDocument()
  })

  it('adds an empty connection', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('admin.exTopo.addConnection'))
    expect(screen.getAllByText('admin.exTopo.endpoint.placeholder').length).toBeGreaterThan(0)
  })
})
