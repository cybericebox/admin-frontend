/**
 * EventDialog.test.tsx — create vs edit mode, validation surfacing,
 * correct API call + backend-error surfacing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/api/events/catalog', () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
}))

import { createEvent, updateEvent } from '@/api/events/catalog'
import { ApiError } from '@/api/client'
import { EventDialog } from './EventDialog'

const mockCreate = vi.mocked(createEvent)
const mockUpdate = vi.mocked(updateEvent)

const EV_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const existing = {
  ID: EV_ID,
  Tag: 'springctf',
  Name: 'Spring CTF',
  AvailableFrom: '2026-03-01T00:00:00Z',
  ArchiveAt: '2026-03-08T00:00:00Z',
  Status: 'pending' as const,
  CreatedAt: '2026-01-01T00:00:00Z',
  UpdatedAt: '2026-01-02T00:00:00Z',
}

function fillValidForm(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText('admin.events.field.tag'), { target: { value: 'autumnctf' } })
  fireEvent.change(within(dialog).getByLabelText('admin.events.field.name'), { target: { value: 'Autumn CTF' } })
  fireEvent.change(within(dialog).getByLabelText('admin.events.field.availableFrom'), { target: { value: '2026-09-01T09:00' } })
  fireEvent.change(within(dialog).getByLabelText('admin.events.field.archiveAt'), { target: { value: '2026-09-08T09:00' } })
}

describe('EventDialog — create mode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the create title and calls createEvent with an RFC3339 window', async () => {
    mockCreate.mockResolvedValue({ ...existing, Tag: 'autumnctf', Name: 'Autumn CTF' })
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    render(<EventDialog open onOpenChange={onOpenChange} onSaved={onSaved} />)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('admin.events.create.title')).toBeInTheDocument()
    fillValidForm(dialog)
    fireEvent.click(within(dialog).getByText('admin.events.dialog.submit'))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const arg = mockCreate.mock.calls[0][0]
    expect(arg).toMatchObject({ Tag: 'autumnctf', Name: 'Autumn CTF' })
    expect(arg.AvailableFrom).toMatch(/Z$/)
    expect(arg.ArchiveAt).toMatch(/Z$/)
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('surfaces a validation error and does not call the API on an invalid tag', async () => {
    render(<EventDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('admin.events.field.tag'), { target: { value: 'BAD TAG' } })
    fireEvent.change(within(dialog).getByLabelText('admin.events.field.availableFrom'), { target: { value: '2026-09-01T09:00' } })
    fireEvent.change(within(dialog).getByLabelText('admin.events.field.archiveAt'), { target: { value: '2026-09-08T09:00' } })
    fireEvent.click(within(dialog).getByText('admin.events.dialog.submit'))

    expect(await within(dialog).findByText('admin.events.val.tag')).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('surfaces a mapped backend error (tag already used)', async () => {
    mockCreate.mockRejectedValue(new ApiError(409, { Status: { Code: 41102 } }))
    render(<EventDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />)
    const dialog = await screen.findByRole('dialog')
    fillValidForm(dialog)
    fireEvent.click(within(dialog).getByText('admin.events.dialog.submit'))

    expect(await within(dialog).findByText('admin.events.err.exists')).toBeInTheDocument()
  })
})

describe('EventDialog — edit mode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pre-fills the tag and calls updateEvent with the event id', async () => {
    mockUpdate.mockResolvedValue({ ...existing, Name: 'Spring CTF 2' })
    const onSaved = vi.fn()
    render(<EventDialog open onOpenChange={vi.fn()} event={existing} onSaved={onSaved} />)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('admin.events.edit.title')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('admin.events.field.tag')).toHaveValue('springctf')

    fireEvent.change(within(dialog).getByLabelText('admin.events.field.name'), { target: { value: 'Spring CTF 2' } })
    fireEvent.click(within(dialog).getByText('admin.events.dialog.submit'))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockUpdate.mock.calls[0][0]).toBe(EV_ID)
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })
})
