/**
 * page.test.tsx — detail card: identity load, PATCH on save,
 * 409 ErrExerciseModified → reload alert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'

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
  restoreVersion: vi.fn(),
  createCheckpoint: vi.fn(),
}))
// The versions table resolves author names via useUserNames; stub it so the
// lifecycle tests never hit the network. Empty map → the row falls back to the
// short id, which is irrelevant to these assertions.
vi.mock('@/lib/userNames', () => ({ useUserNames: () => ({}) }))

import { ApiError } from '@/api/client'
import { getExercise, updateExercise, deleteExercise } from '@/api/exercises/catalog'
import { listVersions, publishDraft, discardDraft, restoreVersion, createCheckpoint } from '@/api/exercises/versions'
import type { VersionListItem } from '@/api/exercises/versions'
import Page from './page'
import { toast } from '@/components/ui/toast'

const mockGet = vi.mocked(getExercise)
const mockUpdate = vi.mocked(updateExercise)
const mockDelete = vi.mocked(deleteExercise)
const mockList = vi.mocked(listVersions)
const mockPublish = vi.mocked(publishDraft)
const mockDiscard = vi.mocked(discardDraft)
const mockRestore = vi.mocked(restoreVersion)
const mockCheckpoint = vi.mocked(createCheckpoint)

const EX_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const exercise = {
  ID: EX_ID,
  Name: 'SQLi basics',
  Description: 'Intro',
  Tags: ['web'],
  DraftVersionID: null,
  PublishedVersionID: null,
  ArchivedAt: null,
  HasChanges: true,
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
    expect(screen.getByDisplayValue('Intro').tagName).toBe('TEXTAREA')
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
    const error = vi.spyOn(toast, 'error')
    mockUpdate.mockRejectedValue(
      new ApiError(409, { Status: { Code: 70904, Message: 'modified' } }, 'modified'),
    )
    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')
    fireEvent.change(screen.getByDisplayValue('SQLi basics'), { target: { value: 'Updated' } })
    fireEvent.click(screen.getByText('admin.exDetail.identity.save'))
    await waitFor(() => expect(error).toHaveBeenCalledWith('admin.ex.err.modified'))
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

  it('shows an error toast and stays put when delete fails', async () => {
    const error = vi.spyOn(toast, 'error')
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
    await waitFor(() => expect(error).toHaveBeenCalledWith('admin.ex.err.generic: boom'))
    // No navigation on failure.
    expect(push).not.toHaveBeenCalled()
    // Busy state reset: the confirm button is re-enabled and the dialog stays open.
    const confirmAfter = screen.getByRole('button', { name: 'admin.exDetail.delete.confirm' })
    expect(confirmAfter).toBeInTheDocument()
    expect(confirmAfter).not.toBeDisabled()
  })

  // ── VersionsCard: lifecycle wiring (confirm dialog → API → re-load) ────────────

  const draftVersion: VersionListItem = {
    ID: 'v1',
    Status: 'draft',
    AdminNote: 'wip',
    VariantCount: 1,
    CreatedAt: '2026-01-03T00:00:00Z',
    CreatedBy: 'u1',
    PublishedAt: null,
  }

  it('publishes the draft after confirming the dialog and reloads the card', async () => {
    mockGet.mockResolvedValue({ ...exercise, DraftVersionID: 'v1' })
    mockList.mockResolvedValue([draftVersion])
    mockPublish.mockResolvedValue({} as never)

    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1))
    const listCalls = mockList.mock.calls.length
    const getCalls = mockGet.mock.calls.length

    // Two buttons share the publish label (status block + draft table row); the
    // first opens the confirm dialog, whose footer confirm shares the label too.
    fireEvent.click(screen.getAllByText('admin.exDetail.publish')[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'admin.exDetail.publish' }))

    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith(EX_ID))
    // Card refreshed: both the versions list and the exercise were re-fetched.
    await waitFor(() => expect(mockList.mock.calls.length).toBeGreaterThan(listCalls))
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(getCalls))
  })

  it('discards the draft after confirming the dialog and reloads the card', async () => {
    mockGet.mockResolvedValue({ ...exercise, DraftVersionID: 'v1' })
    mockList.mockResolvedValue([draftVersion])
    mockDiscard.mockResolvedValue(undefined)

    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1))
    const listCalls = mockList.mock.calls.length

    fireEvent.click(screen.getAllByText('admin.exDetail.discard')[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'admin.exDetail.discard' }))

    await waitFor(() => expect(mockDiscard).toHaveBeenCalledWith(EX_ID))
    await waitFor(() => expect(mockList.mock.calls.length).toBeGreaterThan(listCalls))
  })

  it('rolls back to an unpublished version and reloads the card', async () => {
    const unpublished: VersionListItem = {
      ...draftVersion, ID: 'v2', Status: 'unpublished', PublishedAt: '2026-01-04T00:00:00Z',
    }
    mockGet.mockResolvedValue({ ...exercise, PublishedVersionID: 'v3' })
    mockList.mockResolvedValue([unpublished])
    mockRestore.mockResolvedValue({} as never)

    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1))
    const listCalls = mockList.mock.calls.length

    // Rollback is offered only in the table row.
    fireEvent.click(screen.getByText('admin.exVersions.rollback'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'admin.exVersions.rollback' }))

    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith(EX_ID, 'v2'))
    await waitFor(() => expect(mockList.mock.calls.length).toBeGreaterThan(listCalls))
  })

  it('creates a deliberate checkpoint without publishing the draft', async () => {
    mockGet.mockResolvedValue({ ...exercise, DraftVersionID: 'v1' })
    mockList.mockResolvedValue([draftVersion])
    mockCheckpoint.mockResolvedValue({} as never)
    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')
    fireEvent.click(await screen.findByRole('button', { name: 'admin.exVersions.checkpoint' }))
    await waitFor(() => expect(mockCheckpoint).toHaveBeenCalledWith(EX_ID))
    expect(mockPublish).not.toHaveBeenCalled()
  })

  it('shows the mapped error and re-enables the action when publish fails', async () => {
    const error = vi.spyOn(toast, 'error')
    mockGet.mockResolvedValue({ ...exercise, DraftVersionID: 'v1' })
    mockList.mockResolvedValue([draftVersion])
    mockPublish.mockRejectedValue(
      new ApiError(500, { Status: { Code: 99999, Message: 'boom' } }, 'boom'),
    )

    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getAllByText('admin.exDetail.publish')[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'admin.exDetail.publish' }))

    // Real exerciseErrorMessage (not mocked) maps the unknown code to the generic
    // key and appends the backend message.
    await waitFor(() => expect(error).toHaveBeenCalledWith('admin.ex.err.generic: boom'))
    // Busy resets on failure: the dialog closes and the publish button is enabled.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getAllByText('admin.exDetail.publish')[0].closest('button')).not.toBeDisabled()
    expect(push).not.toHaveBeenCalled()
  })
})
