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
      <DeviceCard variantIndex={0} deviceIndex={0} disabled={false} />
    </FormProvider>
  )
}

describe('DeviceCard', () => {
  it('container: shows one selected settings section at a time', () => {
    const device = emptyDevice()
    device.Name = 'web'
    render(<Harness device={device} />)
    expect(screen.getByText('admin.exTopo.image')).toBeInTheDocument()
    expect(screen.queryByText('admin.exTopo.ifaceName')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'admin.exTopo.external' })).not.toBeInTheDocument()
    expect(screen.getByText('admin.exTopo.deviceName').closest('label')).toHaveTextContent('*')
    expect(screen.getByRole('button', { name: 'admin.exTopo.deviceNameHelp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'admin.exTopo.imageHelp' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.interfaces' }))
    expect(screen.getByText('admin.exTopo.ifaceName').closest('label')).toHaveTextContent('*')
    expect(screen.getByRole('button', { name: 'admin.exTopo.ipTypeHelp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'admin.exTopo.ipType' })).toHaveClass('h-10')
    expect(screen.queryByText('admin.exTopo.image')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.external' }))
    expect(screen.getByRole('switch', { name: 'admin.exTopo.external' })).toBeInTheDocument()
    expect(screen.queryByText('admin.exTopo.ifaceName')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'admin.exTopo.external' }))
    expect(screen.getByText('admin.exTopo.port').closest('label')).toHaveClass('leading-5')
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.interfaces' }))
    expect(screen.queryByRole('button', { name: 'admin.exTopo.removeInterface' })).not.toBeInTheDocument()
  })

  it('unmanaged-switch: only name and type', () => {
    const device = emptyDevice()
    device.Name = 'sw1'
    device.Type = 'unmanaged-switch'
    device.Interfaces = []
    render(<Harness device={device} />)
    expect(screen.queryByText('admin.exTopo.image')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'admin.exTopo.interfaces' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'admin.exTopo.external' })).not.toBeInTheDocument()
  })

  it('restores the required first interface when changing a switch into a container', () => {
    const device = emptyDevice()
    device.Name = 'sw1'
    device.Type = 'unmanaged-switch'
    device.Interfaces = []
    render(<Harness device={device} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'admin.exTopo.deviceType' }), { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('menuitemradio', { name: /admin.exTopo.type.container/ }))
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.interfaces' }))
    expect(screen.getByDisplayValue('eth0')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'admin.exTopo.removeInterface' })).not.toBeInTheDocument()
  })

  it('explains every security profile and IP assignment mode in their menus', () => {
    const device = emptyDevice()
    device.Name = 'web'
    render(<Harness device={device} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'admin.exTopo.securityPreset' }), { key: 'ArrowDown' })
    expect(screen.getByText('admin.exTopo.security.netHelp')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.interfaces' }))
    fireEvent.keyDown(screen.getByRole('button', { name: 'admin.exTopo.ipType' }), { key: 'ArrowDown' })
    expect(screen.getByText('admin.exTopo.ip.dhcpPresetHelp')).toBeInTheDocument()
  })

  it('stored secret env var: Secret checkbox is locked until the value is replaced', () => {
    const device = emptyDevice()
    device.Name = 'web'
    device.EnvVars = [{ Name: 'API_KEY', Value: '', Secret: true, HasValue: true }]
    render(<Harness device={device} />)
    fireEvent.click(screen.getByRole('button', { name: 'admin.exEnv.title' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'admin.exEnv.title' }))

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox).toBeEnabled()
    expect(screen.queryByText('admin.exSecret.lockedHint')).not.toBeInTheDocument()
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
  })

  it('keeps interface and variable editors separate when both lists grow', () => {
    const device = emptyDevice()
    device.Name = 'web'
    device.Interfaces.push({ ...device.Interfaces[0], Name: 'eth1' })
    device.EnvVars = [
      { Name: 'FIRST', Value: '1', Secret: false, HasValue: false },
      { Name: 'SECOND', Value: '2', Secret: false, HasValue: false },
    ]
    render(<Harness device={device} />)
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.interfaces' }))
    expect(screen.getAllByRole('button', { name: 'admin.exTopo.removeInterface' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'admin.exTopo.removeInterface' })[0].closest('[role="tablist"]')).toBeInTheDocument()
    expect(screen.getByDisplayValue('eth0')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('eth1')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'eth1' }))
    expect(screen.getByDisplayValue('eth1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.exEnv.title' }))
    expect(screen.getAllByRole('button', { name: 'admin.exEnv.remove' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'admin.exEnv.remove' })[0].closest('[role="tablist"]')).toBeInTheDocument()
    expect(screen.getByDisplayValue('FIRST')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('SECOND')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'SECOND' }))
    expect(screen.getByDisplayValue('SECOND')).toBeInTheDocument()
  })

  it('keeps the one variable delete action next to its list entry, not below its fields', () => {
    const device = emptyDevice()
    device.EnvVars = [{ Name: 'DB_PASS', Value: '', Secret: false, HasValue: false }]
    render(<Harness device={device} />)
    fireEvent.click(screen.getByRole('button', { name: 'admin.exEnv.title' }))
    expect(screen.getByRole('button', { name: 'admin.exEnv.remove' }).closest('[role="tablist"]')).toBeInTheDocument()
  })
})
