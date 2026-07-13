/**
 * DeviceCard.test.tsx — switch/hub show only name+type; container shows everything.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { DeviceCard } from './DeviceCard'
import { emptyDraft, emptyDevice, type DraftFormValues, type DeviceFormValues } from '@/lib/exerciseSchemas'

function Harness({ device }: { device: DeviceFormValues }) {
  const draft = emptyDraft()
  draft.Variants[0].Topology.Devices = [device]
  const form = useForm<DraftFormValues>({ defaultValues: draft })
  return (
    <FormProvider {...form}>
      <DeviceCard variantIndex={0} deviceIndex={0} disabled={false} onRemove={() => {}} />
    </FormProvider>
  )
}

describe('DeviceCard', () => {
  it('container: shows image, interfaces and external access', () => {
    const device = emptyDevice()
    device.Name = 'web'
    render(<Harness device={device} />)
    expect(screen.getByText('admin.exTopo.image')).toBeInTheDocument()
    expect(screen.getByText('admin.exTopo.interfaces')).toBeInTheDocument()
    expect(screen.getByText('admin.exTopo.external')).toBeInTheDocument()
  })

  it('unmanaged-switch: only name and type', () => {
    const device = emptyDevice()
    device.Name = 'sw1'
    device.Type = 'unmanaged-switch'
    device.Interfaces = []
    render(<Harness device={device} />)
    expect(screen.queryByText('admin.exTopo.image')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.exTopo.interfaces')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.exTopo.external')).not.toBeInTheDocument()
  })
})
