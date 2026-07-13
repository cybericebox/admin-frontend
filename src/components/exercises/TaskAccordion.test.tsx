/**
 * TaskAccordion.test.tsx — variant tasks accordion: add/remove with the ≥1 guard.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

// Stub the heavy Lexical editor: TaskForm (rendered by an open row) imports it, and
// jsdom does not need the real rich-text stack for these behavior tests.
vi.mock('@/components/notifications/editor/RichTextEditor', () => ({
  default: () => <div data-testid="rich-text-editor" />,
}))

import { TaskAccordion } from './TaskAccordion'
import { emptyDraft, emptyTask, type DraftFormValues, type TaskFormValues } from '@/lib/exerciseSchemas'

function Harness({ tasks, disabled = false }: { tasks: TaskFormValues[]; disabled?: boolean }) {
  const draft = emptyDraft()
  draft.Variants[0].Tasks = tasks
  const form = useForm<DraftFormValues>({ defaultValues: draft })
  return (
    <FormProvider {...form}>
      <TaskAccordion variantIndex={0} disabled={disabled} />
    </FormProvider>
  )
}

function task(name: string): TaskFormValues {
  return { ...emptyTask(), Name: name }
}

describe('TaskAccordion', () => {
  it('single task → the remove-task button is absent (≥1 guard)', () => {
    render(<Harness tasks={[task('only')]} />)
    expect(screen.queryByText('admin.exTask.remove')).not.toBeInTheDocument()
  })

  it('two tasks → remove button present; clicking it drops to one task', () => {
    render(<Harness tasks={[task('first'), task('second')]} />)
    // Row 0 is open by default → its remove-task button is visible.
    expect(screen.getByText('admin.exTask.remove')).toBeInTheDocument()
    fireEvent.click(screen.getByText('admin.exTask.remove'))
    // Down to one task → the guard hides the remove button again.
    expect(screen.queryByText('admin.exTask.remove')).not.toBeInTheDocument()
  })

  it('add-task button appends an empty task (count increases)', () => {
    render(<Harness tasks={[task('first')]} />)
    // One task → no accordion header shows the untitled fallback yet.
    fireEvent.click(screen.getByText('admin.exTask.add'))
    // The appended empty task has no Name → its header uses the untitled fallback.
    expect(screen.getByText('admin.exTask.untitled 2')).toBeInTheDocument()
    // Two tasks now → the remove-task control becomes available.
    expect(screen.getByText('admin.exTask.remove')).toBeInTheDocument()
  })

  it('disabled=true → add-task and remove-task controls are absent (read-only)', () => {
    render(<Harness tasks={[task('first'), task('second')]} disabled />)
    expect(screen.queryByText('admin.exTask.add')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.exTask.remove')).not.toBeInTheDocument()
  })
})
