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

    fireEvent.click(screen.getByLabelText('remove-device-0'))
    expect(screen.queryAllByText('admin.exTopo.deviceName')).toHaveLength(0)
  })
})
