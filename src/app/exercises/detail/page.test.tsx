/**
 * page.test.tsx — detail card: identity load, PATCH on save,
 * 409 ErrExerciseModified → reload alert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// Mutable mock state hoisted above vi.mock: `canDelete` toggles the RBAC gate on
// the DeleteCard so a single useRole mock can serve both the gated and ungated tests.
const h = vi.hoisted(() => ({ canDelete: true }))

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({
    me: null,
    role: 'admin',
    isLoading: false,
    permissions: ['*'],
    can: (p: string) => (p === 'exercises.delete' ? h.canDelete : true),
  }),
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
import { getExercise, updateExercise, deleteExercise } from '@/api/exercises/catalog'
import Page from './page'

const mockGet = vi.mocked(getExercise)
const mockUpdate = vi.mocked(updateExercise)
const mockDelete = vi.mocked(deleteExercise)

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
    h.canDelete = true
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

  // ── DeleteCard ──────────────────────────────────────────────────────────────

  it('hides the delete action when the caller lacks exercises.delete', async () => {
    h.canDelete = false
    render(<Page />)
    // Wait for the exercise to load so the card region is rendered, not the spinner.
    await screen.findByDisplayValue('SQLi basics')
    expect(screen.queryByText('admin.exDetail.delete.button')).not.toBeInTheDocument()
  })

  it('deletes the exercise and returns to the catalog on confirm', async () => {
    mockDelete.mockResolvedValue(undefined)
    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')

    // Open the confirm dialog, then confirm.
    fireEvent.click(screen.getByRole('button', { name: 'admin.exDetail.delete.button' }))
    const confirm = await screen.findByRole('button', { name: 'admin.exDetail.delete.confirm' })
    fireEvent.click(confirm)

    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1))
    expect(mockDelete).toHaveBeenCalledWith(EX_ID)
    await waitFor(() => expect(push).toHaveBeenCalledWith('/exercises'))
  })

  it('shows an inline error and stays put when delete fails', async () => {
    mockDelete.mockRejectedValue(
      new ApiError(500, { Status: { Code: 99999, Message: 'boom' } }, 'boom'),
    )
    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')

    fireEvent.click(screen.getByRole('button', { name: 'admin.exDetail.delete.button' }))
    const confirm = await screen.findByRole('button', { name: 'admin.exDetail.delete.confirm' })
    fireEvent.click(confirm)

    // exerciseErrorMessage (real, not mocked) maps the unknown code to the generic
    // key and appends the backend message — proves the error path rendered it.
    expect(await screen.findByText('admin.ex.err.generic: boom')).toBeInTheDocument()
    // No navigation on failure.
    expect(push).not.toHaveBeenCalled()
    // Busy state reset: the confirm button is re-enabled and the dialog stays open.
    const confirmAfter = screen.getByRole('button', { name: 'admin.exDetail.delete.confirm' })
    expect(confirmAfter).toBeInTheDocument()
    expect(confirmAfter).not.toBeDisabled()
  })
})
