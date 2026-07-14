/**
 * page.test.tsx — events catalog: row render, debounced search, RBAC-gated
 * actions, create/edit dialog open, archive + delete confirm flows.
 * EventDialog is stubbed (its own test covers internals).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import React from 'react'

const h = vi.hoisted(() => ({ canWrite: true }))

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({
    me: null, role: 'admin', isLoading: false, permissions: ['*'],
    can: (p: string) => (p === 'events.write' ? h.canWrite : true),
  }),
}))
vi.mock('@/api/events/catalog', () => ({
  listEvents: vi.fn(),
  archiveEvent: vi.fn(),
  deleteEvent: vi.fn(),
}))
vi.mock('@/components/events/EventDialog', () => ({
  EventDialog: ({ open, event, onSaved }: { open: boolean; event?: { ID: string }; onSaved: (e: unknown) => void }) =>
    open
      ? React.createElement(
          'div',
          { role: 'dialog' },
          event ? 'edit-mode' : 'create-mode',
          React.createElement('button', { onClick: () => onSaved({ ID: event?.ID ?? 'new' }) }, 'mock-save'),
        )
      : null,
}))

import { listEvents, archiveEvent, deleteEvent } from '@/api/events/catalog'
import Page from './page'

const mockList = vi.mocked(listEvents)
const mockArchive = vi.mocked(archiveEvent)
const mockDelete = vi.mocked(deleteEvent)

class IO { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('IntersectionObserver', IO)

const EV_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const activeEvent = {
  ID: EV_ID,
  Tag: 'springctf',
  Name: 'Spring CTF',
  AvailableFrom: '2026-03-01T00:00:00Z',
  ArchiveAt: '2026-03-08T00:00:00Z',
  Status: 'active' as const,
  CreatedAt: '2026-01-01T00:00:00Z',
  UpdatedAt: '2026-01-02T00:00:00Z',
}

describe('events catalog page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.canWrite = true
    mockList.mockResolvedValue({ Events: [activeEvent], NextCursor: '', HasMore: false })
  })

  it('renders a row with tag, name and an active status badge', async () => {
    render(<Page />)
    expect(await screen.findByText('springctf')).toBeInTheDocument()
    expect(screen.getByText('Spring CTF')).toBeInTheDocument()
    expect(screen.getByText('admin.events.status.active')).toBeInTheDocument()
  })

  it('renders the empty state', async () => {
    mockList.mockResolvedValue({ Events: [], NextCursor: '', HasMore: false })
    render(<Page />)
    expect(await screen.findByText('admin.events.empty')).toBeInTheDocument()
  })

  it('debounces search and passes it to listEvents', async () => {
    render(<Page />)
    await screen.findByText('springctf')
    fireEvent.change(screen.getByPlaceholderText('admin.events.search'), { target: { value: 'ctf' } })
    await waitFor(() => {
      const calls = mockList.mock.calls
      expect(calls[calls.length - 1][0]).toMatchObject({ search: 'ctf' })
    })
  })

  it('hides the create button without events.write', async () => {
    h.canWrite = false
    render(<Page />)
    await screen.findByText('springctf')
    expect(screen.queryByText('admin.events.create.button')).not.toBeInTheDocument()
  })

  it('opens the create dialog from the header button', async () => {
    render(<Page />)
    await screen.findByText('springctf')
    fireEvent.click(screen.getByText('admin.events.create.button'))
    expect(await screen.findByText('create-mode')).toBeInTheDocument()
  })

  it('opens the edit dialog from a row action', async () => {
    render(<Page />)
    await screen.findByText('springctf')
    fireEvent.click(screen.getByText('admin.events.action.edit'))
    expect(await screen.findByText('edit-mode')).toBeInTheDocument()
  })

  it('hides row actions without events.write', async () => {
    h.canWrite = false
    render(<Page />)
    await screen.findByText('springctf')
    expect(screen.queryByText('admin.events.action.edit')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.events.action.archive')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.events.action.delete')).not.toBeInTheDocument()
  })

  it('archives after confirming and swaps the row to archived', async () => {
    mockArchive.mockResolvedValue({ ...activeEvent, Status: 'archived' })
    render(<Page />)
    await screen.findByText('springctf')
    fireEvent.click(screen.getByText('admin.events.action.archive'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByText('admin.events.archive.confirm'))
    await waitFor(() => expect(mockArchive).toHaveBeenCalledWith(EV_ID))
    expect(await screen.findByText('admin.events.status.archived')).toBeInTheDocument()
  })

  it('does not show Archive for an already-archived event', async () => {
    mockList.mockResolvedValue({ Events: [{ ...activeEvent, Status: 'archived' }], NextCursor: '', HasMore: false })
    render(<Page />)
    await screen.findByText('springctf')
    expect(screen.queryByText('admin.events.action.archive')).not.toBeInTheDocument()
  })

  it('deletes after confirming and removes the row', async () => {
    mockDelete.mockResolvedValue(undefined)
    render(<Page />)
    await screen.findByText('springctf')
    fireEvent.click(screen.getByText('admin.events.action.delete'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByText('admin.events.delete.confirm'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(EV_ID))
    await waitFor(() => expect(screen.queryByText('springctf')).not.toBeInTheDocument())
  })
})
