/**
 * page.test.tsx — events catalog: row render, debounced search, RBAC-gated
 * actions, create-page navigation, archive + delete confirm flows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import React from 'react'

const h = vi.hoisted(() => ({ canWrite: true }))

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/origins', () => ({ eventDomain: 'cybericebox-dev.pp.ua', apiOrigin: '', mainOrigin: '/', idOrigin: '' }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({
    me: null, role: 'admin', isLoading: false, permissions: ['*'],
    can: (p: string) => (p === 'events.write' ? h.canWrite : true),
  }),
}))
vi.mock('@/api/events/catalog', () => ({
  listEventsPage: vi.fn(),
  archiveEvent: vi.fn(),
  deleteEvent: vi.fn(),
}))
import { listEventsPage, archiveEvent, deleteEvent, type Event } from '@/api/events/catalog'
import Page from './page'

const mockList = vi.mocked(listEventsPage)
const mockArchive = vi.mocked(archiveEvent)
const mockDelete = vi.mocked(deleteEvent)

const EV_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const activeEvent = {
  ID: EV_ID,
  Tag: 'springctf',
  Name: 'Spring CTF',
  AvailableFrom: '2026-03-01T00:00:00Z',
  ArchiveAt: '2026-03-08T00:00:00Z',
  Status: 'active' as const,
  LifecycleStatus: 'started' as const,
  CreatedAt: '2026-01-01T00:00:00Z',
  UpdatedAt: '2026-01-02T00:00:00Z',
}

describe('events catalog page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockReset()
    mockArchive.mockReset()
    mockDelete.mockReset()
    h.canWrite = true
    mockList.mockResolvedValue({ Items: [activeEvent], Total: 1, Page: 1, PageSize: 50 })
  })

  it('shows the name first and the full public domain as a site link', async () => {
    render(<Page />)
    expect(await screen.findByRole('link', { name: /admin.events.action.openSite/ })).toBeInTheDocument()
    expect(screen.getByText('Spring CTF')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Spring CTF' })).toHaveAttribute('href', `/events/detail?id=${EV_ID}`)
    expect(screen.getByRole('link', { name: /admin.events.action.openSite/ })).toHaveAttribute('href', 'https://springctf.cybericebox-dev.pp.ua')
    const siteLink = screen.getByRole('link', { name: /admin.events.action.openSite/ })
    fireEvent.mouseEnter(siteLink)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('admin.events.action.openSite')
    fireEvent.mouseLeave(siteLink)
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
    const headers = screen.getAllByRole('columnheader')
    expect(headers[0]).toHaveTextContent('admin.events.col.name')
    expect(headers[1]).toHaveTextContent('admin.events.col.tag')
    expect(screen.getByText('admin.events.lifecycle.started')).toBeInTheDocument()
    const row = screen.getByRole('row', { name: /Spring CTF/ })
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('Spring CTF')
    expect(within(row).getAllByRole('cell')[1]).toHaveTextContent('springctf.cybericebox-dev.pp.ua')
    expect(within(row).getAllByRole('cell')[1]).not.toHaveTextContent('https://')
    expect(within(row).getAllByRole('cell')[5]).toHaveTextContent(/02 січня 2026 р\. о \d{2}:\d{2}:\d{2}/)
    const statusHelp = screen.getByRole('button', { name: 'admin.events.col.statusHelp' })
    fireEvent.mouseEnter(statusHelp)
    expect(await screen.findByRole('tooltip')).toHaveClass('z-[100]')
    fireEvent.click(statusHelp)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.mouseLeave(statusHelp)
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  })

  it('renders the empty state', async () => {
    mockList.mockResolvedValue({ Items: [], Total: 0, Page: 1, PageSize: 50 })
    render(<Page />)
    expect(await screen.findByText('admin.events.emptyInitial')).toBeInTheDocument()
    expect(screen.getByText('admin.events.emptyInitial').closest('[data-empty-state]')?.querySelector('svg')).toBeInTheDocument()
  })

  it('keeps column headings above rows within the scrolling table', async () => {
    const { container } = render(<Page />)
    await screen.findByText('Spring CTF')
    expect(container.querySelector('thead')).toHaveClass('sticky', 'top-0', 'z-10', 'bg-card')
  })

  it('uses the same empty icon with a different message after search', async () => {
    mockList.mockResolvedValue({ Items: [], Total: 0, Page: 1, PageSize: 50 })
    render(<Page />)
    await screen.findByText('admin.events.emptyInitial')
    fireEvent.change(screen.getByPlaceholderText('admin.events.search'), { target: { value: 'missing' } })
    expect(await screen.findByText('admin.events.empty')).toBeInTheDocument()
    expect(screen.getByText('admin.events.empty').closest('[data-empty-state]')?.querySelector('svg')).toBeInTheDocument()
  })

  it('lets an administrator retry a failed first-page load', async () => {
    mockList.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ Items: [activeEvent], Total: 1, Page: 1, PageSize: 50 })
    render(<Page />)

    expect(await screen.findByText('admin.events.loadError')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'error.load.retry' }))
    expect(await screen.findByRole('link', { name: 'Spring CTF' })).toBeInTheDocument()
  })

  it('stops automatic pagination retries after a failure and offers a manual retry', async () => {
    const nextEvent = { ...activeEvent, ID: 'other-event', Name: 'Autumn CTF' }
    mockList.mockResolvedValueOnce({ Items: [activeEvent], Total: 51, Page: 1, PageSize: 50 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ Items: [nextEvent], Total: 51, Page: 2, PageSize: 50 })
    render(<Page />)
    expect(await screen.findByRole('link', { name: 'Spring CTF' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.table.next' }))
    expect(await screen.findByText('admin.events.loadError')).toBeInTheDocument()
    expect(mockList).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'error.load.retry' }))
    expect(await screen.findByRole('link', { name: 'Autumn CTF' })).toBeInTheDocument()
  })

  it('keeps the requested page when the idle search debounce settles', async () => {
    mockList.mockResolvedValue({ Items: [activeEvent], Total: 51, Page: 1, PageSize: 50 })
    render(<Page />)
    await screen.findByRole('link', { name: 'Spring CTF' })
    fireEvent.click(screen.getByRole('button', { name: 'admin.table.next' }))
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)))
    expect(mockList.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 })
  })

  it('does not append an old page after the search filter changes', async () => {
    let resolveOldPage: ((page: { Items: typeof activeEvent[]; Total: number; Page: number; PageSize: number }) => void) | undefined
    const autumnEvent = { ...activeEvent, ID: 'autumn-event', Name: 'Autumn CTF' }
    const staleEvent = { ...activeEvent, ID: 'stale-event', Name: 'Stale CTF' }
    mockList.mockImplementation((filter) => {
      if (filter.page === 2) return new Promise((resolve) => { resolveOldPage = resolve })
      if (filter.search === 'autumn') return Promise.resolve({ Items: [autumnEvent], Total: 1, Page: 1, PageSize: 50 })
      return Promise.resolve({ Items: [activeEvent], Total: 51, Page: 1, PageSize: 50 })
    })
    render(<Page />)
    expect(await screen.findByRole('link', { name: 'Spring CTF' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.table.next' }))
    await waitFor(() => expect(resolveOldPage).toBeDefined())
    fireEvent.change(screen.getByPlaceholderText('admin.events.search'), { target: { value: 'autumn' } })
    expect(await screen.findByRole('link', { name: 'Autumn CTF' })).toBeInTheDocument()

    await act(async () => resolveOldPage?.({ Items: [staleEvent], Total: 51, Page: 2, PageSize: 50 }))
    expect(screen.queryByRole('link', { name: 'Stale CTF' })).not.toBeInTheDocument()
  })

  it('shows the pre-moderator stage before domain access opens', async () => {
    mockList.mockResolvedValue({ Items: [{ ...activeEvent, Status: 'pending' }], Total: 1, Page: 1, PageSize: 50 })
    render(<Page />)
    expect(await screen.findByText('admin.events.lifecycle.not_available')).toBeInTheDocument()
  })

  it('labels an open-ended archive date explicitly', async () => {
    mockList.mockResolvedValue({ Items: [{ ...activeEvent, ArchiveAt: null }], Total: 1, Page: 1, PageSize: 50 })
    render(<Page />)
    expect(await screen.findByText('admin.events.notScheduled')).toBeInTheDocument()
  })

  it('does not render an old zero timestamp as year one', async () => {
    mockList.mockResolvedValue({ Items: [{ ...activeEvent, ArchiveAt: '0001-01-01T00:00:00Z' }], Total: 1, Page: 1, PageSize: 50 })
    render(<Page />)
    expect(await screen.findByText('admin.events.notScheduled')).toBeInTheDocument()
  })

  it('debounces search and passes it to listEvents', async () => {
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    fireEvent.change(screen.getByPlaceholderText('admin.events.search'), { target: { value: 'ctf' } })
    await waitFor(() => {
      const calls = mockList.mock.calls
      expect(calls[calls.length - 1][0]).toMatchObject({ search: 'ctf' })
    })
  })

  it('filters by lifecycle and sorts by clicking column headings', async () => {
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    const filter = screen.getByRole('button', { name: 'admin.events.filterStatus' })
    fireEvent.keyDown(filter, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'admin.events.lifecycle.started' }))
    await waitFor(() => expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ status: 'started', page: 1 })))
    fireEvent.click(screen.getByRole('button', { name: 'admin.events.col.name' }))
    await waitFor(() => expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ status: 'started', sortBy: 'name', sortDir: 'asc' })))
  })

  it('keeps the event link clickable after re-choosing the current filter', async () => {
    render(<Page />)
    const link = await screen.findByRole('link', { name: 'Spring CTF' })
    const filter = screen.getByRole('button', { name: 'admin.events.filterStatus' })
    fireEvent.keyDown(filter, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'admin.events.filterAll' }))
    // No request follows an unchanged filter, so nothing may stay marked as loading.
    expect(link.closest('.pointer-events-none')).toBeNull()
    expect(link.closest('[aria-busy="true"]')).toBeNull()
  })

  it('keeps toolbar controls at the same height', async () => {
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    for (const control of [
      screen.getByPlaceholderText('admin.events.search'),
      screen.getByRole('button', { name: 'admin.events.filterStatus' }),
      screen.getByRole('link', { name: 'admin.events.create.button' }),
    ]) expect(control).toHaveClass('h-10')
  })

  it('hides the create button without events.write', async () => {
    h.canWrite = false
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    expect(screen.queryByText('admin.events.create.button')).not.toBeInTheDocument()
  })

  it('opens a separate create page from the header', async () => {
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    expect(screen.getByRole('link', { name: 'admin.events.create.button' })).toHaveAttribute('href', '/events/new')
  })

  it('keeps event configuration out of the platform admin', async () => {
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    expect(screen.queryByText('admin.events.action.edit')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Spring CTF' })).toHaveAttribute('href', `/events/detail?id=${EV_ID}`)
  })

  it('hides row actions without events.write', async () => {
    h.canWrite = false
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    expect(screen.queryByText('admin.events.action.edit')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'admin.events.action.archive' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'admin.events.action.delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Spring CTF' })).toBeInTheDocument()
  })

  it('reveals compact actions on row hover or keyboard focus and explains each icon', async () => {
    render(<Page />)
    const row = await screen.findByRole('row', { name: /Spring CTF/ })
    expect(row).toHaveClass('group')
    const archive = within(row).getByRole('button', { name: 'admin.events.action.archive' })
    const remove = within(row).getByRole('button', { name: 'admin.events.action.delete' })
    expect(archive.parentElement?.parentElement).toHaveClass('opacity-0', 'group-hover:opacity-100', 'group-focus-within:opacity-100', '[@media(hover:none)]:opacity-100')
    expect(archive).toHaveClass('h-8', 'w-8')
    expect(remove).toHaveClass('h-8', 'w-8', 'text-destructive', 'hover:bg-destructive/10')
    fireEvent.mouseEnter(archive)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('admin.events.action.archive')
    fireEvent.mouseLeave(archive)
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
    fireEvent.focus(remove)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('admin.events.action.delete')
  })

  it('archives after confirming and swaps the row to archived', async () => {
    mockArchive.mockResolvedValue({ ...activeEvent, Status: 'archived' })
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    fireEvent.click(screen.getByRole('button', { name: 'admin.events.action.archive' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByText('admin.events.archive.confirm'))
    await waitFor(() => expect(mockArchive).toHaveBeenCalledWith(EV_ID))
    expect(await screen.findByText('admin.events.lifecycle.archived')).toBeInTheDocument()
  })

  it.each(['published', 'started', 'finished'] as const)('shows a red warning when participants can access a %s event', async (lifecycle) => {
    mockList.mockResolvedValue({ Items: [{ ...activeEvent, LifecycleStatus: lifecycle }], Total: 1, Page: 1, PageSize: 50 })
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    fireEvent.click(screen.getByRole('button', { name: 'admin.events.action.archive' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('alert')).toHaveClass('border-destructive/60')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('admin.events.archive.publicTitle')
    expect(mockArchive).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: 'admin.events.archive.confirm' })).toBeEnabled()
  })

  it.each(['not_published', 'withdrawn'] as const)('shows an orange warning when only moderators can access a %s event', async (lifecycle) => {
    mockList.mockResolvedValue({ Items: [{ ...activeEvent, LifecycleStatus: lifecycle }], Total: 1, Page: 1, PageSize: 50 })
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    fireEvent.click(screen.getByRole('button', { name: 'admin.events.action.archive' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('alert')).toHaveClass('bg-[var(--ib-warn-bg)]')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('admin.events.archive.moderatorsTitle')
    expect(within(dialog).getByRole('button', { name: 'admin.events.archive.confirm' })).toBeEnabled()
  })

  it('uses the ordinary confirmation when moderators cannot access the event', async () => {
    mockList.mockResolvedValue({ Items: [{ ...activeEvent, Status: 'pending', LifecycleStatus: 'published' }], Total: 1, Page: 1, PageSize: 50 })
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    fireEvent.click(screen.getByRole('button', { name: 'admin.events.action.archive' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('admin.events.archive.body')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'admin.events.archive.confirm' })).toBeEnabled()
  })

  it('does not show Archive for an already-archived event', async () => {
    mockList.mockResolvedValue({ Items: [{ ...activeEvent, Status: 'archived' }], Total: 1, Page: 1, PageSize: 50 })
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    expect(screen.queryByRole('button', { name: 'admin.events.action.archive' })).not.toBeInTheDocument()
  })

  it('deletes after confirming and removes the row', async () => {
    mockDelete.mockResolvedValue(undefined)
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    fireEvent.click(screen.getByRole('button', { name: 'admin.events.action.delete' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByText('admin.events.delete.confirm'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(EV_ID))
    await waitFor(() => expect(screen.queryByRole('link', { name: /admin.events.action.openSite/ })).not.toBeInTheDocument())
    expect(screen.getByText('admin.table.total: 0')).toBeInTheDocument()
  })

  it('keeps the confirmation open while an archive request is pending', async () => {
    let finishArchive: ((event: Event) => void) | undefined
    mockArchive.mockImplementation(() => new Promise((resolve) => { finishArchive = resolve }))
    render(<Page />)
    await screen.findByRole('link', { name: /admin.events.action.openSite/ })
    fireEvent.click(screen.getByRole('button', { name: 'admin.events.action.archive' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByText('admin.events.archive.confirm'))
    await waitFor(() => expect(mockArchive).toHaveBeenCalledWith(EV_ID))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => finishArchive?.({ ...activeEvent, Status: 'archived' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
