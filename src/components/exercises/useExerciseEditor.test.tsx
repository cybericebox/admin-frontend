import { useEffect } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import type { Exercise } from "@/api/exercises/catalog"
import type { Version } from "@/api/exercises/versions"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/components/ui/toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@/api/exercises/catalog", () => ({
  createExercise: vi.fn(), getExercise: vi.fn(), updateExercise: vi.fn(), updateExerciseKeepalive: vi.fn(),
}))
vi.mock("@/api/exercises/versions", () => ({
  EMPTY_VERSION_ID: "00000000-0000-0000-0000-000000000000",
  isStoredVersionId: (id: string) => id !== "" && id !== "00000000-0000-0000-0000-000000000000",
  getDraft: vi.fn(), getVersion: vi.fn(), saveDraft: vi.fn(), saveDraftKeepalive: vi.fn(),
}))

import { createExercise, getExercise, updateExercise } from "@/api/exercises/catalog"
import { getDraft, getVersion, saveDraft } from "@/api/exercises/versions"
import { toast } from "@/components/ui/toast"
import { pendingBufferKey, writePendingChanges } from "@/lib/exercisePendingBuffer"
import { emptyTask, toDraftFormValues } from "@/lib/exerciseSchemas"
import { useExerciseEditor, type ExerciseEditor, type UseExerciseEditorOptions } from "./useExerciseEditor"

const mockCreate = vi.mocked(createExercise)
const mockGetExercise = vi.mocked(getExercise)
const mockUpdate = vi.mocked(updateExercise)
const mockGetDraft = vi.mocked(getDraft)
const mockGetVersion = vi.mocked(getVersion)
const mockSaveDraft = vi.mocked(saveDraft)

const exercise: Exercise = {
  ID: "ex-1", Name: "Web 101", Description: "", Tags: [], DraftVersionID: "draft-1", PublishedVersionID: null,
  ArchivedAt: null, HasChanges: true, CreatedAt: "", CreatedBy: null, UpdatedAt: "", UpdatedBy: null,
}
const created: Exercise = { ...exercise, ID: "new-exercise", Name: "Buffer overflow", DraftVersionID: null }
const serverVersion: Version = {
  ID: "draft-1", ExerciseID: "ex-1", Status: "draft", AdminNote: "", Label: "", CreatedAt: "", CreatedBy: null, PublishedAt: null,
  Variants: [{ ID: "variant-1", Index: 1, Note: "", Tasks: [{ ID: "task-1", Name: "Find the flag", Description: null,
    Difficulty: "easy", Flag: ["ICE{server}"], LinkedDeviceID: "", DeviceFlagVar: "", Attachments: [], Placeholders: [] }],
    Topology: { VPN: { Enabled: false, DHCP: true }, Internet: { Enabled: false, DHCP: true }, Devices: [], Connections: [], VisualRender: null } }],
}

let latest: ExerciseEditor
let storage: Map<string, string>

function Harness(props: Partial<UseExerciseEditorOptions>) {
  const editor = useExerciseEditor({
    exerciseId: null, versionId: null, editable: true, canWrite: true, userId: "editor-1",
    onCreated: vi.fn(), onPendingRestored: vi.fn(), ...props,
  })
  // Reassigning a module-scope variable during render is impure; capture it in an
  // effect instead — flushed synchronously by `act()` before any assertion runs.
  useEffect(() => { latest = editor })
  if (editor.loadState === "notFound") return <p>not found</p>
  if (editor.loadState !== "ready") return <p>loading</p>
  return <form>
    <input aria-label="name" {...editor.identityForm.register("Name")} />
    <span data-testid="status">{editor.autosave.status}</span>
  </form>
}

beforeEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  storage = new Map()
  Object.defineProperty(window, "localStorage", { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, String(value)) },
    removeItem: (key: string) => { storage.delete(key) },
    clear: () => { storage.clear() },
  } })
  mockCreate.mockResolvedValue(created)
  mockGetExercise.mockResolvedValue(exercise)
  mockUpdate.mockImplementation(async (_id, input) => ({ ...exercise, ...input }))
  mockGetDraft.mockResolvedValue(serverVersion)
  mockSaveDraft.mockResolvedValue(serverVersion)
})

describe("useExerciseEditor", () => {
  it("creates the exercise once the name is valid, then saves the working copy", async () => {
    const onCreated = vi.fn()
    render(<Harness onCreated={onCreated} />)
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "ab" } })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(mockCreate).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Buffer overflow" } })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(mockCreate).toHaveBeenCalledWith({ Name: "Buffer overflow", Description: "", Tags: [] })
    expect(onCreated).toHaveBeenCalledWith(created)
    expect(mockSaveDraft).toHaveBeenCalledWith("new-exercise", expect.objectContaining({ AdminNote: "" }))
    expect(screen.getByTestId("status")).toHaveTextContent("saved")
  })

  it("keeps unconfirmed edits in the buffer until the server acknowledges them", async () => {
    mockSaveDraft.mockRejectedValueOnce(new Error("offline"))
    render(<Harness />)
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Buffer overflow" } })
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(storage.get(pendingBufferKey("editor-1", null))).toContain("Buffer overflow")
    await act(async () => { await vi.advanceTimersByTimeAsync(700) })
    expect(screen.getByTestId("status")).toHaveTextContent("error")
    expect(storage.has(pendingBufferKey("editor-1", null))).toBe(false)
    expect(storage.get(pendingBufferKey("editor-1", "new-exercise"))).toContain("Buffer overflow")
    await act(async () => { await latest.autosave.flush() })
    expect(storage.has(pendingBufferKey("editor-1", "new-exercise"))).toBe(false)
  })

  it("adopts server-assigned IDs without another save", async () => {
    render(<Harness />)
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Buffer overflow" } })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(latest.draftForm.getValues("Variants.0.ID")).toBe("variant-1")
    expect(latest.draftForm.getValues("Variants.0.Tasks.0.ID")).toBe("task-1")
    expect(latest.getDraftVersionId()).toBe("draft-1")
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(mockSaveDraft).toHaveBeenCalledTimes(1)
  })

  it("adopts nothing when a task is added to the form while the save is still in flight", async () => {
    let resolveSave: (value: Version) => void = () => undefined
    mockSaveDraft.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve }))
    render(<Harness />)
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Buffer overflow" } })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(mockCreate).toHaveBeenCalled()
    expect(mockSaveDraft).toHaveBeenCalledTimes(1)
    // While that saveDraft is still in flight, a task is added to the live form.
    act(() => {
      latest.draftForm.setValue("Variants.0.Tasks", [
        ...latest.draftForm.getValues("Variants.0.Tasks"),
        { ...emptyTask(), Name: "Second task" },
      ])
    })
    await act(async () => { resolveSave(serverVersion) })
    // The response was for the ID-less single-task snapshot sent before the add — the
    // form's ID sequence no longer matches it, so no IDs from that response are adopted.
    expect(latest.draftForm.getValues("Variants.0.ID")).toBe("")
    expect(latest.draftForm.getValues("Variants.0.Tasks.0.ID")).toBe("")
  })

  it("applies buffered edits to the loaded copy, keeps server flags, and sends them", async () => {
    const draft = toDraftFormValues(serverVersion)
    draft.Variants[0].Tasks[0].Name = "Edited offline"
    writePendingChanges(pendingBufferKey("editor-1", "ex-1"), { Name: "Offline name", Description: "", Tags: [] }, draft)
    const onPendingRestored = vi.fn()
    render(<Harness exerciseId="ex-1" onPendingRestored={onPendingRestored} />)
    expect(await screen.findByDisplayValue("Offline name")).toBeInTheDocument()
    expect(latest.draftForm.getValues("Variants.0.Tasks.0.Flag")).toEqual(["ICE{server}"])
    expect(toast.success).toHaveBeenCalledWith("admin.exPage.toast.pendingRestored")
    expect(onPendingRestored).toHaveBeenCalled()
    await act(async () => { await latest.autosave.flush() })
    expect(mockUpdate).toHaveBeenCalledWith("ex-1", { Name: "Offline name", Description: "", Tags: [] })
    expect(mockSaveDraft).toHaveBeenCalledWith("ex-1", expect.objectContaining({
      Variants: [expect.objectContaining({ Tasks: [expect.objectContaining({ Name: "Edited offline", Flag: ["ICE{server}"] })] })],
    }))
  })

  it("turns the empty working copy into one editable variant and never exposes the zero ID", async () => {
    mockGetDraft.mockResolvedValue({ ...serverVersion, ID: "00000000-0000-0000-0000-000000000000", Variants: [] })
    render(<Harness exerciseId="ex-1" editable={false} />)
    await screen.findByDisplayValue("Web 101")
    expect(latest.draftForm.getValues("Variants")).toHaveLength(1)
    expect(latest.getDraftVersionId()).toBe("")
  })

  it("loads a history version read-only and leaves the buffer alone", async () => {
    writePendingChanges(pendingBufferKey("editor-1", "ex-1"), { Name: "Offline", Description: "", Tags: [] }, toDraftFormValues(serverVersion))
    mockGetVersion.mockResolvedValue({ ...serverVersion, ID: "snap-1", Status: "checkpoint" })
    render(<Harness exerciseId="ex-1" versionId="snap-1" editable={false} />)
    expect(await screen.findByDisplayValue("Web 101")).toBeInTheDocument()
    expect(mockGetVersion).toHaveBeenCalledWith("ex-1", "snap-1")
    expect(mockGetDraft).not.toHaveBeenCalled()
    expect(storage.has(pendingBufferKey("editor-1", "ex-1"))).toBe(true)
  })

  it("reports a missing exercise", async () => {
    mockGetExercise.mockRejectedValue(new Error("404"))
    render(<Harness exerciseId="missing" />)
    expect(await screen.findByText("not found")).toBeInTheDocument()
  })
})
