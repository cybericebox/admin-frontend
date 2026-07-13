/**
 * page.test.tsx — каталог exercises: рендер списка, debounce-поиск, фильтр тегов.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({ me: null, role: 'admin', isLoading: false, permissions: ['*'], can: () => true }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/exercises/catalog', () => ({
  listExercises: vi.fn(),
  createExercise: vi.fn(),
}))

import { listExercises } from '@/api/exercises/catalog'
import Page from './page'

const mockList = vi.mocked(listExercises)

// jsdom не имеет IntersectionObserver — инфскролл-сентинел получает заглушку.
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', IO)

const item = {
  ID: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  Name: 'SQLi basics',
  Description: 'Intro to SQL injection',
  Tags: ['web', 'sql'],
  HasDraft: true,
  HasPublished: false,
  CreatedAt: '2026-01-01T00:00:00Z',
  UpdatedAt: '2026-01-02T00:00:00Z',
}

describe('exercises catalog page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue({ Exercises: [item], NextCursor: '', HasMore: false })
  })

  it('renders a row with name, tags and draft status', async () => {
    render(<Page />)
    expect(await screen.findByText('SQLi basics')).toBeInTheDocument()
    expect(screen.getByText('web')).toBeInTheDocument()
    expect(screen.getByText('sql')).toBeInTheDocument()
    expect(screen.getByText('admin.ex.status.draft')).toBeInTheDocument()
    const link = screen.getByText('SQLi basics').closest('a')
    expect(link).toHaveAttribute('href', `/exercises/detail?id=${item.ID}`)
  })

  it('renders the empty state', async () => {
    mockList.mockResolvedValue({ Exercises: [], NextCursor: '', HasMore: false })
    render(<Page />)
    expect(await screen.findByText('admin.ex.empty')).toBeInTheDocument()
  })

  it('debounces search and passes it to listExercises', async () => {
    render(<Page />)
    await screen.findByText('SQLi basics')
    fireEvent.change(screen.getByPlaceholderText('admin.ex.search'), { target: { value: 'sql' } })
    await waitFor(() => {
      const calls = mockList.mock.calls
      expect(calls[calls.length - 1][0]).toMatchObject({ search: 'sql' })
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
})
