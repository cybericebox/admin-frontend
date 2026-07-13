/**
 * DeviceCard.test.tsx — switch/hub show only name+type; container shows everything.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('stored secret env var: Secret checkbox is locked until the value is replaced', () => {
    const device = emptyDevice()
    device.Name = 'web'
    device.EnvVars = [{ Name: 'API_KEY', Value: '', Secret: true, HasValue: true }]
    render(<Harness device={device} />)

    // Locked: cannot un-secret a stored secret whose plaintext we never had.
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox).toBeDisabled()
    expect(checkbox.checked).toBe(true)
    expect(screen.getByText('admin.exSecret.lockedHint')).toBeInTheDocument()

    // Providing a fresh value (Replace → type) unlocks the checkbox.
    fireEvent.click(screen.getByText('admin.exSecret.replace'))
    fireEvent.change(screen.getByTestId('secret-value-input'), { target: { value: 'new-secret' } })
    expect(screen.getByRole('checkbox')).toBeEnabled()
    expect(screen.queryByText('admin.exSecret.lockedHint')).not.toBeInTheDocument()
  })

  it('non-stored secret env var (HasValue=false): Secret checkbox toggles freely', () => {
    const device = emptyDevice()
    device.Name = 'web'
    device.EnvVars = [{ Name: 'API_KEY', Value: '', Secret: true, HasValue: false }]
    render(<Harness device={device} />)

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox).toBeEnabled()
    expect(screen.queryByText('admin.exSecret.lockedHint')).not.toBeInTheDocument()
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
  })
})
