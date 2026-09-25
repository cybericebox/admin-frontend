/**
 * TaskAccordion.test.tsx — variant tasks accordion: add/remove with the ≥1 guard.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm, useWatch, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

// Stub the heavy Lexical editor: TaskForm (rendered by an open row) imports it, and
// jsdom does not need the real rich-text stack for these behavior tests.
vi.mock('@/components/notifications/editor/RichTextEditor', () => ({
  default: () => <div data-testid="rich-text-editor" />,
}))

import { TaskAccordion } from './TaskAccordion'
import { draftSchema, emptyDevice, emptyDraft, emptyTask, emptyVariant, type DraftFormValues, type TaskFormValues } from '@/lib/exerciseSchemas'

function Harness({ tasks, otherTasks, disabled = false }: { tasks: TaskFormValues[]; otherTasks?: TaskFormValues[]; disabled?: boolean }) {
  const draft = emptyDraft()
  draft.Variants[0].Tasks = tasks
  if (otherTasks) {
    const other = emptyVariant(2)
    other.Tasks = otherTasks
    draft.Variants.push(other)
  }
  const form = useForm<DraftFormValues>({ defaultValues: draft })
  const variants = useWatch({ control: form.control, name: 'Variants' })
  return (
    <FormProvider {...form}>
      <TaskAccordion variantIndex={0} disabled={disabled} />
      <output data-testid="variant-tasks">{JSON.stringify(variants.map((variant) => variant.Tasks.map((item) => item.Name)))}</output>
      <output data-testid="variant-difficulty">{JSON.stringify(variants.map((variant) => variant.Tasks.map((item) => item.Difficulty)))}</output>
    </FormProvider>
  )
}

function task(name: string): TaskFormValues {
  return { ...emptyTask(), Name: name }
}

function InvalidFlagLinkHarness() {
  const draft = emptyDraft()
  draft.Variants[0].Tasks[0].Name = 'Find the flag'
  const device = emptyDevice()
  device.Name = 'web'
  draft.Variants[0].Topology.Devices.push(device)
  draft.Variants[0].Tasks[0].LinkedDeviceID = device.ID
  const form = useForm<DraftFormValues>({ defaultValues: draft, resolver: zodResolver(draftSchema) })
  return <FormProvider {...form}>
    <TaskAccordion variantIndex={0} disabled={false} />
    <button type="button" onClick={() => { void form.trigger() }}>Validate draft</button>
  </FormProvider>
}

describe('TaskAccordion', () => {
  it('single task → the remove-task button is absent (≥1 guard)', () => {
    render(<Harness tasks={[task('only')]} />)
    expect(screen.queryByRole('button', { name: 'admin.exTask.remove' })).not.toBeInTheDocument()
  })

  it('two tasks → remove button present; clicking it drops to one task', () => {
    render(<Harness tasks={[task('first'), task('second')]} />)
    // Row 0 is open by default → its remove-task button is visible.
    expect(screen.getByRole('button', { name: 'admin.exTask.remove' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTask.remove' }))
    // Down to one task → the guard hides the remove button again.
    expect(screen.queryByRole('button', { name: 'admin.exTask.remove' })).not.toBeInTheDocument()
  })

  it('add-task button appends an empty task (count increases)', () => {
    render(<Harness tasks={[task('first')]} />)
    // One task → no accordion header shows the untitled fallback yet.
    fireEvent.click(screen.getByText('admin.exTask.add'))
    // The appended empty task has no Name → its header uses the untitled fallback.
    expect(screen.getByText('admin.exTask.untitled 2')).toBeInTheDocument()
    // Two tasks now → the remove-task control becomes available.
    expect(screen.getByRole('button', { name: 'admin.exTask.remove' })).toBeInTheDocument()
  })

  it('adding a stage updates every variant so the draft remains structurally valid', () => {
    render(<Harness tasks={[task('first')]} otherTasks={[task('alternate')]} />)
    fireEvent.click(screen.getByText('admin.exTask.add'))
    expect(screen.getByTestId('variant-tasks')).toHaveTextContent('[["first",""],["alternate",""]]')
  })

  it('removing a stage removes the same position from every variant', () => {
    render(<Harness tasks={[task('first'), task('second')]} otherTasks={[task('alternate'), task('alternate second')]} />)
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTask.remove' }))
    expect(screen.getByTestId('variant-tasks')).toHaveTextContent('[["second"],["alternate second"]]')
  })

  it('changing task difficulty updates the matching stage in every variant', () => {
    render(<Harness tasks={[task('first')]} otherTasks={[task('alternate')]} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'admin.ex.difficulty.easy' }), { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'admin.ex.difficulty.hard' }))
    expect(screen.getByTestId('variant-difficulty')).toHaveTextContent('[["hard"],["hard"]]')
  })

  it('marks required task fields and exposes explanations without marking optional description', () => {
    render(<Harness tasks={[task('first')]} />)
    expect(screen.getByText('admin.exTask.name').closest('label')).toHaveTextContent('*')
    expect(screen.getByRole('button', { name: 'admin.exTask.nameHelp' })).toBeInTheDocument()
    expect(screen.getByText('admin.exTask.difficulty').closest('label')).toHaveTextContent('*')
    expect(screen.getByRole('button', { name: 'admin.exTask.difficultyHelp' })).toBeInTheDocument()
    expect(screen.getByText('admin.exTask.description').parentElement).not.toHaveTextContent('*')
    expect(screen.getByRole('button', { name: 'admin.exTask.descriptionHelp' })).toBeInTheDocument()
  })

  it('disabled=true → add-task and remove-task controls are absent (read-only)', () => {
    render(<Harness tasks={[task('first'), task('second')]} disabled />)
    expect(screen.queryByText('admin.exTask.add')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'admin.exTask.remove' })).not.toBeInTheDocument()
  })

  it('edits only the selected stage while keeping the other stage in local navigation', () => {
    render(<Harness tasks={[task('first'), task('second')]} />)
    expect(screen.getByDisplayValue('first')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('second')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'second' }))
    expect(screen.getByDisplayValue('second')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('first')).not.toBeInTheDocument()
  })

  it('shows the flag-variable validation error beside the linked device fields', async () => {
    render(<InvalidFlagLinkHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Validate draft' }))
    expect(await screen.findByText('admin.ex.val.deviceFlagVarRequired')).toBeInTheDocument()
  })
})
