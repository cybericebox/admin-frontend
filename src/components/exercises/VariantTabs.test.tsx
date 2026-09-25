import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { VariantTabs } from './VariantTabs'
import { emptyDraft, emptyTask, type DraftFormValues } from '@/lib/exerciseSchemas'

function Harness() {
  const draft = emptyDraft()
  draft.Variants[0].Tasks = [
    { ...emptyTask(), ID: 'a', Name: 'First task', Difficulty: 'medium', Flag: ['ICE{secret}'] },
    { ...emptyTask(), ID: 'b', Name: 'Second task', Difficulty: 'hard' },
  ]
  const form = useForm<DraftFormValues>({ defaultValues: draft })
  const variants = useWatch({ control: form.control, name: 'Variants' })
  return <FormProvider {...form}>
    <VariantTabs disabled={false} renderVariant={(index) => <div>Variant content {index}</div>} />
    <output data-testid="variants-json">{JSON.stringify(variants)}</output>
  </FormProvider>
}

describe('VariantTabs', () => {
  it('a new variant inherits the canonical task structure without copying secret flags', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'admin.exDraft.addVariant' }))
    const variants = JSON.parse(screen.getByTestId('variants-json').textContent ?? '[]') as DraftFormValues['Variants']
    expect(variants).toHaveLength(2)
    expect(variants[1].Tasks.map((task) => ({ ID: task.ID, Name: task.Name, Difficulty: task.Difficulty, Flag: task.Flag }))).toEqual([
      { ID: 'a', Name: 'First task', Difficulty: 'medium', Flag: [] },
      { ID: 'b', Name: 'Second task', Difficulty: 'hard', Flag: [] },
    ])
  })
})
