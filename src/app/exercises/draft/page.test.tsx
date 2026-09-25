/**
 * page.test.tsx — draft editor: loading the draft, saving (PUT 1:1), and
 * the read-only version view (?versionId=).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({ me: { ID: 'editor-1' }, role: 'admin', isLoading: false, permissions: ['*'], can: () => true }),
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
vi.mock('@/api/exercises/capabilities', () => ({ getExerciseCapabilities: vi.fn() }))

import { getExercise } from '@/api/exercises/catalog'
import { getVersion, saveDraft, type Version } from '@/api/exercises/versions'
import { getExerciseCapabilities } from '@/api/exercises/capabilities'
import Page from './page'

const mockGetExercise = vi.mocked(getExercise)
const mockGetVersion = vi.mocked(getVersion)
const mockSaveDraft = vi.mocked(saveDraft)
const mockCapabilities = vi.mocked(getExerciseCapabilities)

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
    ID: 'var1', Index: 1, Note: '',
    Tasks: [{
      ID: 't1', Name: 'Find the flag', Description: null, Difficulty: 'easy',
      Flag: [], LinkedDeviceID: '', DeviceFlagVar: '', Attachments: [], Placeholders: [],
    }],
    Topology: {
      VPN: { Enabled: false, DHCP: true }, Internet: { Enabled: false, DHCP: true },
      Devices: [], Connections: [], VisualRender: null,
    },
  }],
}

describe('draft editor page', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    searchParams = new URLSearchParams('id=e1')
    mockGetExercise.mockResolvedValue(exercise)
    mockGetVersion.mockResolvedValue(version)
    mockCapabilities.mockResolvedValue({ Laboratories: true })
    const storage = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, String(value)) },
      removeItem: (key: string) => { storage.delete(key) },
      clear: () => { storage.clear() },
    } })
  })

  it('autosaves a valid edit five seconds after the last change', async () => {
    mockSaveDraft.mockResolvedValue({ ...version, AdminNote: 'latest note' })
    render(<Page />)
    const note = await screen.findByDisplayValue('wip note')
    vi.useFakeTimers()
    fireEvent.change(note, { target: { value: 'first note' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(mockSaveDraft).not.toHaveBeenCalled()
    fireEvent.change(note, { target: { value: 'latest note' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(4999) })
    expect(mockSaveDraft).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(mockSaveDraft).toHaveBeenCalledOnce()
    expect(mockSaveDraft.mock.calls[0][1].AdminNote).toBe('latest note')
    expect(screen.getByText('admin.exDraft.savedNote')).toBeInTheDocument()
    const unload = new Event('beforeunload', { cancelable: true })
    fireEvent(window, unload)
    expect(unload.defaultPrevented).toBe(false)
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(mockSaveDraft).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('does not autosave a structurally invalid draft', async () => {
    render(<Page />)
    const note = await screen.findByDisplayValue('wip note')
    vi.useFakeTimers()
    fireEvent.change(note, { target: { value: 'invalid edit' } })
    fireEvent.change(screen.getByRole('textbox', { name: /admin.exTask.name/ }), { target: { value: '' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(mockSaveDraft).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not overwrite newer input when an autosave response arrives late', async () => {
    let resolveFirst: ((value: Version) => void) | undefined
    mockSaveDraft.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce({ ...version, AdminNote: 'second note' })
    render(<Page />)
    const note = await screen.findByDisplayValue('wip note')
    vi.useFakeTimers()
    fireEvent.change(note, { target: { value: 'first note' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(mockSaveDraft).toHaveBeenCalledOnce()
    fireEvent.change(note, { target: { value: 'second note' } })
    await act(async () => { resolveFirst?.({ ...version, AdminNote: 'first note' }) })
    expect(note).toHaveValue('second note')
    expect(screen.getByText('admin.exDraft.unsaved')).toBeInTheDocument()
    const unload = new Event('beforeunload', { cancelable: true })
    fireEvent(window, unload)
    expect(unload.defaultPrevented).toBe(false)
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(mockSaveDraft).toHaveBeenCalledTimes(2)
    expect(mockSaveDraft.mock.calls[1][1].AdminNote).toBe('second note')
    vi.useRealTimers()
  })

  it('keeps a failed autosave dirty and allows a manual retry', async () => {
    mockSaveDraft.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...version, AdminNote: 'retry note' })
    render(<Page />)
    const note = await screen.findByDisplayValue('wip note')
    vi.useFakeTimers()
    fireEvent.change(note, { target: { value: 'retry note' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(mockSaveDraft).toHaveBeenCalledOnce()
    expect(screen.getByText('admin.exDraft.unsaved')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.exDraft.save' }))
    await act(async () => { await Promise.resolve() })
    expect(mockSaveDraft).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('restores pending changes after reload without a browser prompt', async () => {
    const first = render(<Page />)
    const note = await screen.findByDisplayValue('wip note')
    fireEvent.change(note, { target: { value: 'recover this note' } })
    const unload = new Event('beforeunload', { cancelable: true })
    fireEvent(window, unload)
    expect(unload.defaultPrevented).toBe(false)
    expect(window.localStorage.getItem('cybericebox.admin.exercise-working.v1:editor-1:e1')).toContain('recover this note')
    first.unmount()
    render(<Page />)
    expect(await screen.findByDisplayValue('recover this note')).toBeInTheDocument()
    expect(screen.getByText('admin.exDraft.unsaved')).toBeInTheDocument()
  })

  it('asks before leaving and clears the working copy only on discard', async () => {
    render(<Page />)
    const note = await screen.findByDisplayValue('wip note')
    fireEvent.change(note, { target: { value: 'discard this note' } })
    fireEvent.click(screen.getByRole('link', { name: /admin.exDetail.back/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(window.localStorage.getItem('cybericebox.admin.exercise-working.v1:editor-1:e1')).toContain('discard this note')
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.leave.stay' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /admin.exDetail.back/ }))
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.leaveExisting.discard' }))
    expect(window.localStorage.getItem('cybericebox.admin.exercise-working.v1:editor-1:e1')).toBeNull()
  })

  it('keeps the working copy after a failed save, then clears it on success', async () => {
    mockSaveDraft.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...version, AdminNote: 'saved note' })
    render(<Page />)
    const note = await screen.findByDisplayValue('wip note')
    fireEvent.change(note, { target: { value: 'saved note' } })
    fireEvent.click(screen.getByRole('link', { name: /admin.exDetail.back/ }))
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.leaveExisting.save' }))
    await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledOnce())
    expect(window.localStorage.getItem('cybericebox.admin.exercise-working.v1:editor-1:e1')).toContain('saved note')
    fireEvent.click(screen.getByRole('button', { name: 'admin.ex.leaveExisting.save' }))
    await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledTimes(2))
    expect(window.localStorage.getItem('cybericebox.admin.exercise-working.v1:editor-1:e1')).toBeNull()
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
    expect(screen.queryByText('admin.exTask.linkedDevice')).not.toBeInTheDocument()
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

  it('shows the flag format error next to the value and does not save', async () => {
    render(<Page />)
    await screen.findByDisplayValue('wip note')
    fireEvent.click(screen.getByText('admin.exTask.flag.add'))
    const flagInput = screen.getByRole('textbox', { name: 'admin.exTask.flag.title 1' })
    fireEvent.change(flagInput, { target: { value: 'ICE{has space}' } })
    fireEvent.click(screen.getByText('admin.exDraft.save'))

    expect(await screen.findByText('admin.ex.val.flagFormat')).toBeInTheDocument()
    expect(mockSaveDraft).not.toHaveBeenCalled()
  })

  it('opens the variant containing the first invalid field on save', async () => {
    const twoVariants = structuredClone(version)
    twoVariants.Variants.push({ ...structuredClone(version.Variants[0]), ID: 'var2', Index: 2,
      Tasks: [{ ...structuredClone(version.Variants[0].Tasks[0]), ID: 't2' }] })
    mockGetVersion.mockResolvedValue(twoVariants)
    render(<Page />)
    await screen.findByDisplayValue('wip note')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'admin.exDraft.variant 2' }), { button: 0 })
    expect(screen.getByRole('tab', { name: 'admin.exDraft.variant 2' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByText('admin.exTask.flag.add'))
    fireEvent.change(screen.getByRole('textbox', { name: 'admin.exTask.flag.title 1' }), { target: { value: 'ICE{has space}' } })
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'admin.exDraft.variant 1' }), { button: 0 })

    fireEvent.click(screen.getByRole('button', { name: 'admin.exDraft.save' }))

    await waitFor(() => expect(screen.getByRole('tab', { name: 'admin.exDraft.variant 2' })).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByText('admin.ex.val.flagFormat')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'admin.exTask.flag.title 1' })).toHaveFocus())
    expect(mockSaveDraft).not.toHaveBeenCalled()
  })

  it('restores the selected variant and section after reloading an existing draft', async () => {
    const twoVariants = structuredClone(version)
    twoVariants.Variants.push({ ...structuredClone(version.Variants[0]), ID: 'var2', Index: 2 })
    mockGetVersion.mockResolvedValue(twoVariants)

    const first = render(<Page />)
    await screen.findByDisplayValue('wip note')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'admin.exDraft.variant 2' }), { button: 0 })
    fireEvent.click(screen.getByRole('tab', { name: 'admin.exDraft.tab.topology' }))
    expect(screen.getByRole('tab', { name: 'admin.exDraft.tab.topology' })).toHaveAttribute('aria-selected', 'true')
    first.unmount()

    const stored = window.localStorage.getItem('cybericebox.admin.exercise-position.v1:editor-1:e1')
    expect(stored ?? '').toContain('"section":"topology"')
    expect(stored).not.toContain('wip note')

    render(<Page />)
    await screen.findByDisplayValue('wip note')
    await waitFor(() => expect(screen.getByRole('tab', { name: 'admin.exDraft.variant 2' })).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByRole('tab', { name: 'admin.exDraft.tab.topology' })).toHaveAttribute('aria-selected', 'true')
  })

  it('restores the scroll position after reloading an existing draft', async () => {
    const first = render(<div data-admin-scroll-root><Page /></div>)
    await screen.findByDisplayValue('wip note')
    fireEvent.click(screen.getByRole('tab', { name: 'admin.exDraft.tab.topology' }))
    const firstRoot = first.container.querySelector<HTMLElement>('[data-admin-scroll-root]')!
    firstRoot.scrollTop = 212
    fireEvent.scroll(firstRoot)
    first.unmount()

    const stored = window.localStorage.getItem('cybericebox.admin.exercise-position.v1:editor-1:e1')
    expect(JSON.parse(stored ?? '{}').scrollTop).toBe(212)

    const second = render(<div data-admin-scroll-root><Page /></div>)
    await screen.findByDisplayValue('wip note')
    const secondRoot = second.container.querySelector<HTMLElement>('[data-admin-scroll-root]')!
    await waitFor(() => expect(secondRoot.scrollTop).toBe(212))
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

  it('shows Test only for a dynamic variant when laboratories are available', async () => {
    const dynamicVersion = structuredClone(version)
    dynamicVersion.Variants[0].Topology.Devices = [{
      ID: 'd1', Name: 'lab', Type: 'container', SecurityPreset: '', Image: 'example', Interfaces: [], EnvVars: [], External: null,
      Resources: { CPURequest: '', MemoryRequest: '', CPULimit: '', MemoryLimit: '' },
    }]
    mockGetVersion.mockResolvedValue(dynamicVersion)
    mockCapabilities.mockResolvedValue({ Laboratories: false })
    const { unmount } = render(<Page />)
    await screen.findByDisplayValue('wip note')
    expect(screen.queryByRole('button', { name: 'admin.exDeploy.test' })).not.toBeInTheDocument()
    unmount()
    mockCapabilities.mockResolvedValue({ Laboratories: true })
    render(<Page />)
    expect(await screen.findByRole('button', { name: 'admin.exDeploy.test' })).toBeInTheDocument()
    expect(screen.getByText('admin.exTask.linkedDevice')).toBeInTheDocument()
    expect(screen.queryByText('admin.exTask.deviceFlagVar')).not.toBeInTheDocument()
  })

  it('exposes security preset and DHCP preset settings for a dynamic device', async () => {
    const dynamicVersion = structuredClone(version)
    dynamicVersion.Variants[0].Topology.Devices = [{
      ID: 'd1', Name: 'lab', Type: 'container', SecurityPreset: 'net', Image: 'example', EnvVars: [], External: null,
      Resources: { CPURequest: '', MemoryRequest: '', CPULimit: '', MemoryLimit: '' },
      Interfaces: [{ Name: 'eth0', MAC: '', IP: { Type: 'dhcp-preset', Addresses: [], Gateway: '', Routes: [] } }],
    }]
    mockGetVersion.mockResolvedValue(dynamicVersion)
    render(<Page />)
    await screen.findByDisplayValue('wip note')
    fireEvent.click(screen.getByRole('tab', { name: 'admin.exDraft.tab.topology' }))
    fireEvent.click(screen.getByRole('button', { name: 'lab' }))
    expect(screen.getByText('admin.exTopo.securityPreset')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'admin.exTopo.securityPreset' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.interfaces' }))
    expect(screen.getByRole('button', { name: 'admin.exTopo.ipType' })).toBeInTheDocument()
  })

  it('connects two canvas nodes using their available interfaces', async () => {
    const dynamicVersion = structuredClone(version)
    dynamicVersion.Variants[0].Topology.Devices = [
      { ID: 'd1', Name: 'web', Type: 'container', SecurityPreset: '', Image: 'nginx', EnvVars: [], External: null,
        Resources: { CPURequest: '', MemoryRequest: '', CPULimit: '', MemoryLimit: '' },
        Interfaces: [{ Name: 'eth0', MAC: '', IP: { Type: 'dhcp', Addresses: [], Gateway: '', Routes: [] } }] },
      { ID: 'd2', Name: 'sw1', Type: 'unmanaged-switch', SecurityPreset: '', Image: '', EnvVars: [], External: null, Interfaces: [], Resources: { CPURequest: '', MemoryRequest: '', CPULimit: '', MemoryLimit: '' } },
    ]
    mockGetVersion.mockResolvedValue(dynamicVersion)
    mockSaveDraft.mockResolvedValue(dynamicVersion)
    render(<Page />)
    await screen.findByDisplayValue('wip note')
    fireEvent.click(screen.getByRole('tab', { name: 'admin.exDraft.tab.topology' }))
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.diagram' }))
    fireEvent.click(screen.getByTestId('node-d1'))
    fireEvent.click(screen.getByTestId('node-d2'))
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.addConnection' }))
    fireEvent.click(screen.getByRole('button', { name: 'admin.exTopo.canvasConnect' }))
    fireEvent.click(screen.getByRole('button', { name: 'admin.exDraft.save' }))
    await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledOnce())
    expect(mockSaveDraft.mock.calls[0][1].Variants[0].Topology.Connections).toEqual([{
      Endpoints: [{ Kind: 'device', DeviceID: 'd1', Interface: 'eth0' }, { Kind: 'device', DeviceID: 'd2' }],
    }])
  })
})
