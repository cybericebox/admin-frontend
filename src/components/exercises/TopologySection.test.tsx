/**
 * TopologySection.test.tsx — device add/remove wiring is behavior-focused.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { TopologySection } from './TopologySection'
import { emptyDraft, type DraftFormValues } from '@/lib/exerciseSchemas'

function Harness() {
  const form = useForm<DraftFormValues>({ defaultValues: emptyDraft() })
  return (
    <FormProvider {...form}>
      <TopologySection variantIndex={0} disabled={false} />
    </FormProvider>
  )
}

describe('TopologySection device add/remove', () => {
  it('add-device appends an empty device card; remove drops it', () => {
    render(<Harness />)
    // Empty topology: no device cards yet.
    expect(screen.queryAllByText('admin.exTopo.deviceName')).toHaveLength(0)

    fireEvent.click(screen.getByText('admin.exTopo.addDevice'))
    expect(screen.getAllByText('admin.exTopo.deviceName')).toHaveLength(1)
    expect(screen.queryByRole('img', { name: 'admin.exTopo.diagram' })).not.toBeInTheDocument()

    const remove = screen.getByRole('button', { name: 'admin.exTopo.removeDevice' })
    expect(remove.closest('nav')).toHaveAttribute('aria-label', 'admin.exDraft.topology.title')
    fireEvent.click(remove)
    expect(screen.queryAllByText('admin.exTopo.deviceName')).toHaveLength(0)
  })

  it('shows the canvas once at least two nodes can be connected', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('admin.exTopo.addDevice'))
    fireEvent.click(screen.getByText('admin.exTopo.addDevice'))
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.connections' }))
    expect(screen.getByRole('img', { name: 'admin.exTopo.diagram' })).toBeInTheDocument()
  })

  it('uses the shared empty mark and only offers connections when two endpoints exist', () => {
    render(<Harness />)
    expect(screen.getByText('admin.exTopo.noDevices').closest('[data-empty-state]')).toBeInTheDocument()
    expect(screen.queryByText('admin.exTopo.noConnections')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('admin.exTopo.addDevice'))
    fireEvent.click(screen.getByText('admin.exTopo.addDevice'))
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.connections' }))
    expect(screen.getByText('admin.exTopo.noConnections').closest('[data-empty-state]')).toBeInTheDocument()
  })

  it('shows settings for one selected section instead of stacking gateways and every device', () => {
    render(<Harness />)
    expect(screen.getByText('admin.exTopo.vpn')).toBeInTheDocument()
    fireEvent.click(screen.getByText('admin.exTopo.addDevice'))
    expect(screen.getAllByText('admin.exTopo.deviceName')).toHaveLength(1)
    expect(screen.queryByText('admin.exTopo.vpn')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.gateways' }))
    expect(screen.getByText('admin.exTopo.vpn')).toBeInTheDocument()
    expect(screen.queryByText('admin.exTopo.deviceName')).not.toBeInTheDocument()
  })
})
