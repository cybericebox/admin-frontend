/**
 * page.test.tsx — exercises catalog table and create link.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { emptyDraft } from '@/lib/exerciseSchemas'
import { DEFAULT_EDITOR_POSITION, localDraftStorageKey, makeLocalDraft } from '@/lib/localExerciseDraft'

// Mutable permission state for the create link.
const h = vi.hoisted(() => ({ canWrite: true, userId: 'editor-1', push: vi.fn() }))

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({
    me: { ID: h.userId },
    role: 'admin',
    isLoading: false,
    permissions: ['*'],
    can: (p: string) => (p === 'exercises.write' ? h.canWrite : true),
  }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock('@/api/exercises/catalog', () => ({
  listExercisesPage: vi.fn(),
}))

import { listExercisesPage } from '@/api/exercises/catalog'
import Page from './page'

const mockList = vi.mocked(listExercisesPage)

function resetStorage() {
  const storage = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, String(value)) },
    removeItem: (key: string) => { storage.delete(key) },
    clear: () => { storage.clear() },
  } })
}

const item = {
  ID: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  Name: 'SQLi basics',
  Description: 'Intro to SQL injection',
  Tags: ['web', 'sql'],
  HasDraft: true,
  HasPublished: false,
  ArchivedAt: null,
  CreatedAt: '2026-01-01T00:00:00Z',
  UpdatedAt: '2026-01-02T00:00:00Z',
}

describe('exercises catalog page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStorage()
    mockList.mockReset()
    h.canWrite = true
    mockList.mockResolvedValue({ Items: [item], Total: 1, Page: 1, PageSize: 50 })
  })

  it('renders a row with name, tags and draft status', async () => {
    render(<Page />)
    expect(await screen.findByText('SQLi basics')).toBeInTheDocument()
    expect(screen.getByText('web')).toBeInTheDocument()
    expect(screen.getByText('sql')).toBeInTheDocument()
    expect(screen.getByText('admin.ex.status.draft')).toBeInTheDocument()
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument()
    const link = screen.getByText('SQLi basics').closest('a')
    expect(link).toHaveAttribute('href', `/exercises/detail?id=${item.ID}`)
  })

  it('renders the empty state', async () => {
    mockList.mockResolvedValue({ Items: [], Total: 0, Page: 1, PageSize: 50 })
    render(<Page />)
    expect(await screen.findByText('admin.ex.empty')).toBeInTheDocument()
    expect(screen.getByText('admin.ex.empty').closest('[data-empty-state]')?.querySelector('svg')).toBeInTheDocument()
  })

  it('keeps column headings above rows within the scrolling table', async () => {
    const { container } = render(<Page />)
    await screen.findByText('SQLi basics')
    expect(container.querySelector('thead')).toHaveClass('sticky', 'top-0', 'z-10', 'bg-card')
  })

  it('debounces search and passes it to listExercises', async () => {
    render(<Page />)
    await screen.findByText('SQLi basics')
    expect(screen.getByPlaceholderText('admin.ex.search')).toHaveAttribute('type', 'search')
    fireEvent.change(screen.getByPlaceholderText('admin.ex.search'), { target: { value: 'sql' } })
    await waitFor(() => {
      const calls = mockList.mock.calls
      expect(calls[calls.length - 1][0]).toMatchObject({ search: 'sql', page: 1 })
    })
  })

  it('adds a tag filter chip and passes tags to listExercises', async () => {
    render(<Page />)
    await screen.findByText('SQLi basics')
    const tagBox = screen.getByPlaceholderText('admin.ex.filterTags.placeholder')
    fireEvent.change(tagBox, { target: { value: 'crypto' } })
    fireEvent.keyDown(tagBox, { key: 'Enter' })
    await waitFor(() => {
      const calls = mockList.mock.calls
      expect(calls[calls.length - 1][0]).toMatchObject({ tags: ['crypto'] })
    })
  })

  it('offers a retry after the first page fails', async () => {
    mockList.mockRejectedValueOnce(new Error('offline'))
    render(<Page />)
    expect(await screen.findByText('admin.ex.loadError')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.retry' }))
    expect(await screen.findByText('SQLi basics')).toBeInTheDocument()
  })

  it('keeps old rows while sorting and sorts through the API', async () => {
    let resolveSorted: ((page: { Items: typeof item[]; Total: number; Page: number; PageSize: number }) => void) | undefined
    mockList.mockImplementation((filter) => filter.sortBy === 'name'
      ? new Promise((resolve) => { resolveSorted = resolve })
      : Promise.resolve({ Items: [item], Total: 2, Page: 1, PageSize: 50 }))
    render(<Page />)
    await screen.findByText('SQLi basics')
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.col.name' }))
    expect(screen.getByText('SQLi basics')).toBeInTheDocument()
    await waitFor(() => expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ sortBy: 'name', sortDir: 'asc' })))
    await act(async () => resolveSorted?.({ Items: [{ ...item, ID: 'sorted', Name: 'Crypto basics' }], Total: 2, Page: 1, PageSize: 50 }))
    expect(screen.getByText('Crypto basics')).toBeInTheDocument()
  })

  it('shows total, changes page size, and keeps pagination below rows', async () => {
    mockList.mockResolvedValue({ Items: [item], Total: 75, Page: 1, PageSize: 50 })
    render(<Page />)
    await screen.findByText('SQLi basics')
    expect(screen.getByText('admin.table.total: 75')).toBeInTheDocument()
    expect(screen.getByText('admin.table.page 1 admin.table.of 2')).toBeInTheDocument()
    const selector = screen.getByRole('button', { name: 'admin.table.perPage' })
    fireEvent.keyDown(selector, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    await waitFor(() => expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 25 })))
    expect(screen.queryByText('admin.ex.endOfList')).not.toBeInTheDocument()
  })

  it('keeps search, tag filter, status filter, and create action at the same minimum height', async () => {
    render(<Page />)
    await screen.findByText('SQLi basics')
    expect(screen.getByPlaceholderText('admin.ex.search')).toHaveClass('h-10')
    expect(screen.getByPlaceholderText('admin.ex.filterTags.placeholder').parentElement).toHaveClass('min-h-10')
    expect(screen.getByRole('button', { name: 'admin.ex.filterStatus' })).toHaveClass('h-10')
    expect(screen.getByRole('button', { name: 'admin.ex.create.button' })).toHaveClass('h-10')
  })

  it('ignores a stale next page after the tag filter changes', async () => {
    let resolveOldPage: ((page: { Items: typeof item[]; Total: number; Page: number; PageSize: number }) => void) | undefined
    const fresh = { ...item, ID: 'fresh', Name: 'Crypto basics', Tags: ['crypto'] }
    const stale = { ...item, ID: 'stale', Name: 'Old SQLi' }
    mockList.mockImplementation((filter) => {
      if (filter.page === 2) return new Promise((resolve) => { resolveOldPage = resolve })
      if (filter.tags?.includes('crypto')) return Promise.resolve({ Items: [fresh], Total: 1, Page: 1, PageSize: 50 })
      return Promise.resolve({ Items: [item], Total: 51, Page: 1, PageSize: 50 })
    })
    render(<Page />)
    await screen.findByText('SQLi basics')
    fireEvent.click(screen.getByRole('button', { name: 'admin.table.next' }))
    await waitFor(() => expect(resolveOldPage).toBeDefined())
    const tagBox = screen.getByPlaceholderText('admin.ex.filterTags.placeholder')
    fireEvent.change(tagBox, { target: { value: 'crypto' } })
    fireEvent.keyDown(tagBox, { key: 'Enter' })
    expect(await screen.findByText('Crypto basics')).toBeInTheDocument()
    await act(async () => resolveOldPage?.({ Items: [stale], Total: 51, Page: 2, PageSize: 50 }))
    expect(screen.queryByText('Old SQLi')).not.toBeInTheDocument()
  })

  it('retries a failed next page without discarding the loaded rows', async () => {
    mockList.mockResolvedValueOnce({ Items: [item], Total: 51, Page: 1, PageSize: 50 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ Items: [{ ...item, ID: 'second', Name: 'Crypto basics' }], Total: 51, Page: 2, PageSize: 50 })
    render(<Page />)
    await screen.findByText('SQLi basics')
    fireEvent.click(screen.getByRole('button', { name: 'admin.table.next' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('admin.ex.loadError')
    expect(screen.getByText('SQLi basics')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.retry' }))
    expect(await screen.findByText('Crypto basics')).toBeInTheDocument()
  })
})

describe('exercises catalog — create link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStorage()
    mockList.mockReset()
    h.canWrite = true
    mockList.mockResolvedValue({ Items: [item], Total: 1, Page: 1, PageSize: 50 })
  })

  it('hides the create action without exercises.write permission', async () => {
    h.canWrite = false
    render(<Page />)
    await screen.findByText('SQLi basics')
    expect(screen.queryByRole('button', { name: 'admin.ex.create.button' })).not.toBeInTheDocument()
  })

  it('opens the dedicated creation page when there is no browser draft', async () => {
    render(<Page />)
    await screen.findByText('SQLi basics')
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.create.button' }))
    expect(h.push).toHaveBeenCalledWith('/exercises/new')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('pins the browser draft before server rows despite filters and lets it be deleted', async () => {
    window.localStorage.setItem(localDraftStorageKey(h.userId), JSON.stringify(makeLocalDraft(
      { Name: 'Browser draft', Description: 'Local description', Tags: ['web'] },
      emptyDraft(), DEFAULT_EDITOR_POSITION, null,
    )))
    render(<Page />)
    await screen.findByText('SQLi basics')
    const draftRow = screen.getByText('Browser draft').closest('tr')
    expect(draftRow).toBe(screen.getAllByRole('row')[1])
    expect(draftRow).toHaveTextContent('admin.ex.localDraft.badge')
    expect(draftRow?.querySelector('a')).toHaveAttribute('href', '/exercises/new')
    fireEvent.change(screen.getByPlaceholderText('admin.ex.search'), { target: { value: 'different' } })
    expect(screen.getByText('Browser draft')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.localDraft.delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.localDraft.deleteConfirm' }))
    expect(window.localStorage.getItem(localDraftStorageKey(h.userId))).toBeNull()
    expect(screen.queryByText('Browser draft')).not.toBeInTheDocument()
  })

  it('offers continue or reset before creating another exercise', async () => {
    window.localStorage.setItem(localDraftStorageKey(h.userId), JSON.stringify(makeLocalDraft(
      { Name: 'Existing draft', Description: '', Tags: [] },
      emptyDraft(), DEFAULT_EDITOR_POSITION, null,
    )))
    render(<Page />)
    await screen.findByText('Existing draft')
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.create.button' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('admin.ex.localDraft.confirmTitle')
    expect(dialog).toHaveClass('max-w-xl')
    expect(screen.getByRole('button', { name: 'admin.ex.localDraft.reset' }).parentElement).toHaveClass('flex-wrap')
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.localDraft.continue' }))
    expect(h.push).toHaveBeenCalledWith('/exercises/new')
    expect(window.localStorage.getItem(localDraftStorageKey(h.userId))).not.toBeNull()
    h.push.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.create.button' }))
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.localDraft.reset' }))
    expect(window.localStorage.getItem(localDraftStorageKey(h.userId))).toBeNull()
    expect(h.push).toHaveBeenCalledWith('/exercises/new')
  })
})
