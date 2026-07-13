/**
 * page.test.tsx — detail card: identity load, PATCH on save,
 * 409 ErrExerciseModified → reload alert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({ me: null, role: 'admin', isLoading: false, permissions: ['*'], can: () => true }),
}))
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
}))
vi.mock('@/api/exercises/catalog', () => ({
  getExercise: vi.fn(),
  updateExercise: vi.fn(),
  deleteExercise: vi.fn(),
}))
vi.mock('@/api/exercises/versions', () => ({
  listVersions: vi.fn().mockResolvedValue([]),
  publishDraft: vi.fn(),
  discardDraft: vi.fn(),
  rollbackToVersion: vi.fn(),
}))

import { ApiError } from '@/api/client'
import { getExercise, updateExercise } from '@/api/exercises/catalog'
import Page from './page'

const mockGet = vi.mocked(getExercise)
const mockUpdate = vi.mocked(updateExercise)

const EX_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const exercise = {
  ID: EX_ID,
  Name: 'SQLi basics',
  Description: 'Intro',
  Tags: ['web'],
  DraftVersionID: null,
  PublishedVersionID: null,
  CreatedAt: '2026-01-01T00:00:00Z',
  CreatedBy: null,
  UpdatedAt: '2026-01-02T00:00:00Z',
  UpdatedBy: null,
}

describe('exercise detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue(exercise)
  })

  it('loads the exercise into the identity form', async () => {
    render(<Page />)
    await waitFor(() => expect(screen.getByDisplayValue('SQLi basics')).toBeInTheDocument())
    expect(screen.getByDisplayValue('Intro')).toBeInTheDocument()
    expect(screen.getByText('web')).toBeInTheDocument()
  })

  it('PATCHes the identity on save', async () => {
    mockUpdate.mockResolvedValue({ ...exercise, Name: 'Renamed OK' })
    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')
    fireEvent.change(screen.getByDisplayValue('SQLi basics'), { target: { value: 'Renamed OK' } })
    fireEvent.click(screen.getByText('admin.exDetail.identity.save'))
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(EX_ID, { Name: 'Renamed OK', Description: 'Intro', Tags: ['web'] }),
    )
  })

  it('shows the reload alert on 409 ErrExerciseModified', async () => {
    mockUpdate.mockRejectedValue(
      new ApiError(409, { Status: { Code: 70904, Message: 'modified' } }, 'modified'),
    )
    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')
    fireEvent.click(screen.getByText('admin.exDetail.identity.save'))
    expect(await screen.findByText('admin.ex.err.modified')).toBeInTheDocument()
  })

  it('shows not-found state when the exercise is missing', async () => {
    mockGet.mockRejectedValue(new ApiError(404, { Status: { Code: 30901 } }, 'nf'))
    render(<Page />)
    expect(await screen.findByText('admin.exDetail.notFound')).toBeInTheDocument()
  })
})
