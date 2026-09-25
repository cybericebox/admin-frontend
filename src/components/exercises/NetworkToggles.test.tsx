import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { NetworkToggles } from './NetworkToggles'
import { emptyDraft, type DraftFormValues } from '@/lib/exerciseSchemas'

function Harness() {
  const form = useForm<DraftFormValues>({ defaultValues: emptyDraft() })
  return <FormProvider {...form}><NetworkToggles variantIndex={0} disabled={false} /></FormProvider>
}

describe('NetworkToggles', () => {
  it('shows DHCP only for enabled networks and explains its effect', () => {
    render(<Harness />)
    expect(screen.queryByRole('switch', { name: 'admin.exTopo.vpnDhcp' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'admin.exTopo.internetDhcp' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch', { name: 'admin.exTopo.vpn' }))
    expect(screen.getByRole('switch', { name: 'admin.exTopo.vpnDhcp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'admin.exTopo.dhcpHelp' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'admin.exTopo.internetDhcp' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch', { name: 'admin.exTopo.vpn' }))
    expect(screen.queryByRole('switch', { name: 'admin.exTopo.vpnDhcp' })).not.toBeInTheDocument()
  })
})
