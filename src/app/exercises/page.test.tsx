/**
 * page.test.tsx — каталог exercises: рендер списка, debounce-поиск, фильтр тегов,
 * плюс create-диалог (RBAC-гейт, happy path, error path).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'

// Мутируемое состояние моков, поднятое над vi.mock: `canWrite` переключает
// RBAC-гейт кнопки создания, `push` — стабильный шпион next/navigation.
const h = vi.hoisted(() => ({ canWrite: true, push: vi.fn() }))

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({
    me: null,
    role: 'admin',
    isLoading: false,
    permissions: ['*'],
    can: (p: string) => (p === 'exercises.write' ? h.canWrite : true),
  }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock('@/api/exercises/catalog', () => ({
  listExercises: vi.fn(),
  createExercise: vi.fn(),
}))

import { listExercises, createExercise } from '@/api/exercises/catalog'
import { ApiError } from '@/api/client'
import Page from './page'

const mockList = vi.mocked(listExercises)
const mockCreate = vi.mocked(createExercise)

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
    h.canWrite = true
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

describe('exercises catalog — create dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.canWrite = true
    mockList.mockResolvedValue({ Exercises: [item], NextCursor: '', HasMore: false })
  })

  it('hides the create button without exercises.write permission', async () => {
    h.canWrite = false
    render(<Page />)
    await screen.findByText('SQLi basics')
    expect(screen.queryByText('admin.ex.create.button')).not.toBeInTheDocument()
  })

  it('shows the create button with exercises.write permission', async () => {
    render(<Page />)
    await screen.findByText('SQLi basics')
    expect(screen.getByText('admin.ex.create.button')).toBeInTheDocument()
  })

  it('submits the identity form (PascalCase) and routes to the new exercise', async () => {
    const created = { ...item, ID: 'ffffffff-0000-1111-2222-333333333333', Name: 'Buffer overflow', Description: 'Smash the stack', Tags: ['pwn'] }
    mockCreate.mockResolvedValue(created)

    render(<Page />)
    await screen.findByText('SQLi basics')
    fireEvent.click(screen.getByText('admin.ex.create.button'))

    const dialog = await screen.findByRole('dialog')
    const nameInput = within(dialog).getByLabelText('admin.ex.field.name')
    const descInput = within(dialog).getByLabelText('admin.ex.field.description')
    fireEvent.change(nameInput, { target: { value: 'Buffer overflow' } })
    fireEvent.change(descInput, { target: { value: 'Smash the stack' } })

    // TagInput's inner <input> has no label/placeholder — it's the third textbox.
    const tagInput = within(dialog).getAllByRole('textbox').find((el) => el !== nameInput && el !== descInput)!
    fireEvent.change(tagInput, { target: { value: 'pwn' } })
    fireEvent.keyDown(tagInput, { key: 'Enter' })

    fireEvent.click(within(dialog).getByText('admin.ex.create.submit'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1)
      expect(mockCreate).toHaveBeenCalledWith({ Name: 'Buffer overflow', Description: 'Smash the stack', Tags: ['pwn'] })
    })
    await waitFor(() => {
      expect(h.push).toHaveBeenCalledWith(`/exercises/detail?id=${created.ID}`)
    })
  })

  it('renders the mapped error and does not route when createExercise rejects', async () => {
    // FullCode 40903 → admin.ex.err.exists (exerciseErrorMessage runs for real).
    mockCreate.mockRejectedValue(new ApiError(409, { Status: { Code: 40903 } }))

    render(<Page />)
    await screen.findByText('SQLi basics')
    fireEvent.click(screen.getByText('admin.ex.create.button'))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('admin.ex.field.name'), { target: { value: 'Duplicate name' } })
    fireEvent.change(within(dialog).getByLabelText('admin.ex.field.description'), { target: { value: 'x' } })
    fireEvent.click(within(dialog).getByText('admin.ex.create.submit'))

    expect(await within(dialog).findByText('admin.ex.err.exists')).toBeInTheDocument()
    expect(h.push).not.toHaveBeenCalled()
  })
})
