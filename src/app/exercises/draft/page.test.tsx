/**
 * page.test.tsx — draft editor: loading the draft, saving (PUT 1:1), and
 * the read-only version view (?versionId=).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({ me: null, role: 'admin', isLoading: false, permissions: ['*'], can: () => true }),
}))

let searchParams = new URLSearchParams('id=e1')
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/api/exercises/catalog', () => ({ getExercise: vi.fn() }))
vi.mock('@/api/exercises/versions', () => ({
  getVersion: vi.fn(),
  saveDraft: vi.fn(),
}))

import { getExercise } from '@/api/exercises/catalog'
import { getVersion, saveDraft, type Version } from '@/api/exercises/versions'
import Page from './page'

const mockGetExercise = vi.mocked(getExercise)
const mockGetVersion = vi.mocked(getVersion)
const mockSaveDraft = vi.mocked(saveDraft)

const exercise = {
  ID: 'e1', Name: 'SQLi', Description: '', Tags: [],
  DraftVersionID: 'v1', PublishedVersionID: null,
  CreatedAt: '', CreatedBy: null, UpdatedAt: '', UpdatedBy: null,
}

const version: Version = {
  ID: 'v1', ExerciseID: 'e1', Status: 'draft', AdminNote: 'wip note',
  RegenerateFlagsOnPublish: false,
  CreatedAt: '2026-01-01T00:00:00Z', CreatedBy: null, PublishedAt: null,
  Variants: [{
    ID: 'var1', Index: 1,
    Tasks: [{
      ID: 't1', Name: 'Find the flag', Description: null, Difficulty: 'easy',
      Flag: [], LinkedDeviceID: '', DeviceFlagVar: '', Attachments: [], Placeholders: [],
    }],
    Topology: {
      VPN: { Enabled: false, DHCP: true }, Internet: { Enabled: false, DHCP: true },
      Devices: [], Connections: [],
    },
  }],
}

describe('draft editor page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParams = new URLSearchParams('id=e1')
    mockGetExercise.mockResolvedValue(exercise)
    mockGetVersion.mockResolvedValue(version)
  })

  it('loads the existing draft into the form', async () => {
    render(<Page />)
    await waitFor(() => expect(screen.getByDisplayValue('wip note')).toBeInTheDocument())
    expect(mockGetVersion).toHaveBeenCalledWith('e1', 'v1')
    expect(screen.getByText('admin.exDraft.variant 1')).toBeInTheDocument()
  })

  it('starts from an empty draft when the exercise has none', async () => {
    mockGetExercise.mockResolvedValue({ ...exercise, DraftVersionID: null })
    render(<Page />)
    await waitFor(() => expect(screen.getByText('admin.exDraft.save')).toBeInTheDocument())
    expect(mockGetVersion).not.toHaveBeenCalled()
  })

  it('serializes the form 1:1 into saveDraft on submit', async () => {
    mockSaveDraft.mockResolvedValue(version)
    render(<Page />)
    await screen.findByDisplayValue('wip note')
    fireEvent.change(screen.getByDisplayValue('wip note'), { target: { value: 'updated note' } })
    fireEvent.click(screen.getByText('admin.exDraft.save'))
    await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledOnce())
    const [exId, input] = mockSaveDraft.mock.calls[0]
    expect(exId).toBe('e1')
    expect(input.AdminNote).toBe('updated note')
    expect(input.Variants[0]).toMatchObject({ ID: 'var1', Index: 1 })
    expect(input.Variants[0].Tasks[0]).toMatchObject({ ID: 't1', Name: 'Find the flag' })
  })

  it('read-only mode (?versionId=) hides the save button and disables inputs', async () => {
    searchParams = new URLSearchParams('id=e1&versionId=v9')
    mockGetVersion.mockResolvedValue({ ...version, ID: 'v9', Status: 'unpublished' })
    render(<Page />)
    await waitFor(() => expect(mockGetVersion).toHaveBeenCalledWith('e1', 'v9'))
    expect(screen.queryByText('admin.exDraft.save')).not.toBeInTheDocument()
    expect(screen.getByText('admin.exDraft.readOnly')).toBeInTheDocument()
    expect(screen.getByDisplayValue('wip note')).toBeDisabled()
  })
})
