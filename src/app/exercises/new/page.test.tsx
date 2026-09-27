import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ApiError } from "@/api/client"
import { emptyDraft } from "@/lib/exerciseSchemas"
import { DEFAULT_EDITOR_POSITION, makeLocalDraft } from "@/lib/localExerciseDraft"
import NewExercisePage from "./page"

const state = vi.hoisted(() => ({ canWrite: true, push: vi.fn(), userId: "editor-1" }))

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => state.canWrite, me: { ID: state.userId } }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock("@/api/exercises/catalog", () => ({ createExercise: vi.fn(), updateExercise: vi.fn(), getExercise: vi.fn(), listExerciseTags: vi.fn() }))
vi.mock("@/api/exercises/versions", () => ({ saveDraft: vi.fn(), getVersion: vi.fn() }))

import { createExercise, getExercise, updateExercise, listExerciseTags } from "@/api/exercises/catalog"
import { getVersion, saveDraft } from "@/api/exercises/versions"

const mockCreate = vi.mocked(createExercise)
const mockUpdate = vi.mocked(updateExercise)
const mockSaveDraft = vi.mocked(saveDraft)
const mockGetExercise = vi.mocked(getExercise)
const mockGetVersion = vi.mocked(getVersion)
const mockListTags = vi.mocked(listExerciseTags)
const savedVersion: Awaited<ReturnType<typeof saveDraft>> = {
  ID: "version-1", ExerciseID: "new-exercise", Status: "draft", AdminNote: "", Label: "",
  CreatedAt: "", CreatedBy: null, PublishedAt: null,
  Variants: [{ ID: "variant-1", Index: 1, Note: "", Tasks: [{ ID: "task-1", Name: "Find the flag", Description: null,
    Difficulty: "easy", Flag: [], LinkedDeviceID: "", DeviceFlagVar: "", Attachments: [], Placeholders: [] }],
    Topology: { VPN: { Enabled: false, DHCP: true }, Internet: { Enabled: false, DHCP: true }, Devices: [], Connections: [], VisualRender: null } }],
}

function addCanvasContainer() {
  fireEvent.keyDown(screen.getByRole("button", { name: "admin.exTopo.addDevice" }), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("menuitem", { name: "admin.exTopo.type.container" }))
}

describe("new exercise page", () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    const storage = new Map<string, string>()
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, String(value)) },
      removeItem: (key: string) => { storage.delete(key) },
      clear: () => { storage.clear() },
    } })
    state.canWrite = true
    state.userId = "editor-1"
    mockUpdate.mockResolvedValue({ ID: "new-exercise" } as Awaited<ReturnType<typeof updateExercise>>)
    mockSaveDraft.mockResolvedValue(savedVersion)
    mockListTags.mockResolvedValue([])
  })

  it("autosaves a valid new exercise to the backend after five idle seconds", async () => {
    mockCreate.mockResolvedValue({ ID: "new-exercise" } as Awaited<ReturnType<typeof createExercise>>)
    render(<NewExercisePage />)
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Buffer overflow" } })
    fireEvent.change(screen.getByRole("textbox", { name: /admin.exTask.name/ }), { target: { value: "Find the flag" } })
    await act(async () => { await vi.advanceTimersByTimeAsync(4999) })
    expect(mockCreate).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockSaveDraft).toHaveBeenCalledWith("new-exercise", expect.objectContaining({ Variants: expect.any(Array) }))
    expect(state.push).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("keeps incomplete new-exercise edits local without creating a server record", async () => {
    render(<NewExercisePage />)
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Too incomplete" } })
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(mockCreate).not.toHaveBeenCalled()
    expect(window.localStorage.getItem("cybericebox.admin.exercise-draft.v1:editor-1")).toContain("Too incomplete")
    vi.useRealTimers()
  })

  it("reloads an acknowledged autosave from the server, including flag values", async () => {
    mockCreate.mockResolvedValue({ ID: "new-exercise" } as Awaited<ReturnType<typeof createExercise>>)
    mockSaveDraft.mockResolvedValue({ ...savedVersion, Variants: [{ ...savedVersion.Variants[0], Tasks: [
      { ...savedVersion.Variants[0].Tasks[0], Flag: ["ICE{secret}"] },
    ] }] })
    mockGetExercise.mockResolvedValue({ ID: "new-exercise", Name: "Saved exercise", Description: "", Tags: [], DraftVersionID: "version-1", PublishedVersionID: null, ArchivedAt: null, HasChanges: true, CreatedAt: "", CreatedBy: null, UpdatedAt: "", UpdatedBy: null })
    mockGetVersion.mockImplementation(async () => await mockSaveDraft.mock.results[0].value)
    const first = render(<NewExercisePage />)
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Saved exercise" } })
    fireEvent.change(screen.getByRole("textbox", { name: /admin.exTask.name/ }), { target: { value: "Find the flag" } })
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(mockSaveDraft).toHaveBeenCalledOnce()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "admin.ex.create.tab.variants" }), { button: 0 })
    await act(async () => { await vi.advanceTimersByTimeAsync(350) })
    const stored = JSON.parse(window.localStorage.getItem("cybericebox.admin.exercise-draft.v1:editor-1")!)
    expect(stored.serverSynced).toBe(true)
    expect(stored.position.tab).toBe("variants")
    expect(JSON.stringify(stored)).toContain("ICE{secret}")
    first.unmount()
    vi.useRealTimers()
    render(<NewExercisePage />)
    await waitFor(() => expect(mockGetVersion).toHaveBeenCalledWith("new-exercise", "version-1"))
    expect(await screen.findByRole("tab", { name: "admin.ex.create.tab.variants", selected: true })).toBeInTheDocument()
    expect(await screen.findByDisplayValue("Saved exercise")).toBeInTheDocument()
  })

  it("shows a full-page form with a multiline description and catalog back link", () => {
    render(<NewExercisePage />)
    expect(screen.getByRole("heading", { name: "admin.ex.create.title" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /admin.exDetail.back/ })).toHaveAttribute("href", "/exercises")
    expect(screen.getByLabelText("admin.ex.field.description").tagName).toBe("TEXTAREA")
    expect(screen.getByLabelText("admin.ex.field.tags")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows the general fields, their help, and version note without an extra settings disclosure", () => {
    render(<NewExercisePage />)
    expect(screen.getByRole("button", { name: "admin.ex.help.name" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "admin.ex.field.descriptionHelp" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "admin.ex.field.tagsHelp" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "admin.ex.create.notes" })).toBeVisible()
    expect(screen.getByRole("button", { name: "admin.exDraft.adminNoteHelp" })).toBeInTheDocument()
    expect(screen.queryByText("admin.exDraft.settings.title")).not.toBeInTheDocument()
  })

  it("keeps the warning for omitted flag values in the compact status after an edit", async () => {
    const draft = emptyDraft()
    draft.Variants[0].Tasks[0].Flag = ["ICE{secret}"]
    const snapshot = makeLocalDraft({ Name: "Recovered", Description: "", Tags: [] }, draft, DEFAULT_EDITOR_POSITION, null)
    snapshot.draft.Variants[0].Tasks[0].Flag = [""]
    snapshot.omitted = { flags: 1, secrets: 0 }
    window.localStorage.setItem("cybericebox.admin.exercise-draft.v1:editor-1", JSON.stringify(snapshot))
    render(<NewExercisePage />)
    expect(await screen.findByRole("status", { name: "admin.ex.create.localOmitted" })).toBeInTheDocument()
    expect(screen.queryByText("admin.ex.create.localOmitted")).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Changed" } })
    expect(screen.getByRole("status", { name: "admin.ex.create.localOmitted" })).toBeInTheDocument()
  })

  it("fetches prefix suggestions while typing a tag", async () => {
    mockListTags.mockResolvedValue([{ Tag: "crypto", Count: 4 }])
    render(<NewExercisePage />)
    fireEvent.change(screen.getByPlaceholderText("admin.ex.tagHint"), { target: { value: "cr" } })
    expect(await screen.findByRole("option", { name: /crypto\s*·\s*4/ })).toBeInTheDocument()
    expect(mockListTags).toHaveBeenCalledWith("cr")
  })

  it("blocks users without exercises.write", () => {
    state.canWrite = false
    render(<NewExercisePage />)
    expect(screen.getByRole("alert")).toHaveTextContent("admin.ex.create.forbidden")
    expect(screen.queryByRole("button", { name: "admin.ex.create.submit" })).not.toBeInTheDocument()
  })

  it("shows laboratory flag delivery only when this variant has a suitable device", () => {
    render(<NewExercisePage />)
    fireEvent.click(screen.getByRole("tab", { name: "admin.ex.create.tab.variants" }))
    expect(screen.queryByText("admin.exTask.flagDelivery")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "admin.exDraft.tab.topology" }))
    addCanvasContainer()
    fireEvent.click(screen.getByRole("tab", { name: "admin.exDraft.tab.tasks" }))
    expect(screen.getByText("admin.exTask.flagDelivery")).toBeInTheDocument()
  })

  it("opens the hidden device interface when that section blocks saving", async () => {
    render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Network task" } })
    fireEvent.click(screen.getByRole("tab", { name: "admin.ex.create.tab.variants" }))
    fireEvent.change(screen.getByRole("textbox", { name: /admin.exTask.name/ }), { target: { value: "Find the flag" } })
    fireEvent.click(screen.getByRole("tab", { name: "admin.exDraft.tab.topology" }))
    addCanvasContainer()
    fireEvent.contextMenu(screen.getByRole("button", { name: "host-1" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "admin.exTopo.configure" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.interfaces" }))
    fireEvent.keyDown(screen.getByRole("button", { name: "admin.exTopo.ipType" }), { key: "ArrowDown" })
    fireEvent.click(screen.getByRole("menuitemradio", { name: /admin.exTopo.ip.static/ }))
    fireEvent.click(screen.getByRole("tab", { name: "admin.exDraft.tab.tasks" }))

    fireEvent.click(screen.getByRole("button", { name: "admin.ex.create.submit" }))

    await waitFor(() => expect(screen.getByRole("tab", { name: "admin.exDraft.tab.topology" })).toHaveAttribute("aria-selected", "true"))
    expect(screen.getByRole("img", { name: "admin.exTopo.diagram" })).toBeInTheDocument()
    expect(screen.getByRole("complementary", { name: "admin.exTopo.deviceSettings" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "admin.exTopo.interfaces" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByText("admin.exTopo.addresses")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.devices" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.diagram" }))
    expect(screen.getByRole("complementary", { name: "admin.exTopo.deviceSettings" })).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("focuses the first invalid field after revealing the task editor", async () => {
    render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Network task" } })
    fireEvent.click(screen.getByRole("button", { name: "admin.ex.create.submit" }))

    await waitFor(() => expect(screen.getByRole("tab", { name: "admin.ex.create.tab.variants" })).toHaveAttribute("aria-selected", "true"))
    await waitFor(() => expect(screen.getByRole("textbox", { name: /admin.exTask.name/ })).toHaveFocus())
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("creates the identity and first variant together, then opens the detail page", async () => {
    mockCreate.mockResolvedValue({ ID: "new-exercise" } as Awaited<ReturnType<typeof createExercise>>)
    render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Buffer overflow" } })
    fireEvent.change(screen.getByLabelText("admin.ex.field.description"), { target: { value: "Smash the stack" } })
    fireEvent.change(screen.getByPlaceholderText("admin.ex.tagHint"), { target: { value: "pwn" } })
    fireEvent.click(screen.getByRole("tab", { name: "admin.ex.create.tab.variants" }))
    fireEvent.change(screen.getByRole("textbox", { name: /admin.exTask.name/ }), { target: { value: "Find the flag" } })
    fireEvent.click(screen.getByRole("button", { name: "admin.ex.create.submit" }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ Name: "Buffer overflow", Description: "Smash the stack", Tags: ["pwn"] }))
    expect(mockSaveDraft).toHaveBeenCalledWith("new-exercise", expect.objectContaining({
      Variants: [expect.objectContaining({ Tasks: [expect.objectContaining({ Name: "Find the flag" })] })],
    }))
    expect(state.push).toHaveBeenCalledWith("/exercises/detail?id=new-exercise")
  })

  it("retries a failed draft save without creating a duplicate exercise", async () => {
    mockCreate.mockResolvedValue({ ID: "new-exercise" } as Awaited<ReturnType<typeof createExercise>>)
    mockSaveDraft.mockRejectedValueOnce(new ApiError(500, { Status: { Code: 500 } }))
    render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "New exercise" } })
    fireEvent.click(screen.getByRole("tab", { name: "admin.ex.create.tab.variants" }))
    fireEvent.change(screen.getByRole("textbox", { name: /admin.exTask.name/ }), { target: { value: "Find the flag" } })
    fireEvent.click(screen.getByRole("button", { name: "admin.ex.create.submit" }))
    expect(await screen.findByText("admin.ex.create.partialSave")).toBeInTheDocument()
    expect(state.push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "admin.ex.create.submit" }))
    await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledTimes(2))
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(state.push).toHaveBeenCalledWith("/exercises/detail?id=new-exercise")
  })

  it("keeps entered values and shows the server error after a failed save", async () => {
    mockCreate.mockRejectedValue(new ApiError(409, { Status: { Code: 40903 } }))
    render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Duplicate name" } })
    fireEvent.click(screen.getByRole("tab", { name: "admin.ex.create.tab.variants" }))
    fireEvent.change(screen.getByRole("textbox", { name: /admin.exTask.name/ }), { target: { value: "Find the flag" } })
    fireEvent.click(screen.getByRole("button", { name: "admin.ex.create.submit" }))
    expect(await screen.findByText("admin.ex.err.exists")).toBeInTheDocument()
    expect(screen.getByLabelText(/admin.ex.field.name/)).toHaveValue("Duplicate name")
    expect(state.push).not.toHaveBeenCalled()
  })

  it("rejects an uncommitted tag longer than the allowed limit", async () => {
    render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "New exercise" } })
    fireEvent.change(screen.getByPlaceholderText("admin.ex.tagHint"), { target: { value: "a".repeat(31) } })
    fireEvent.click(screen.getByRole("button", { name: "admin.ex.create.submit" }))
    expect(await screen.findByText("admin.ex.val.tag")).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("keeps a local draft and returns to the selected topology panel after reload", async () => {
    const first = render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Recover me" } })
    fireEvent.mouseDown(screen.getByRole("tab", { name: "admin.ex.create.tab.variants" }), { button: 0 })
    fireEvent.click(screen.getByRole("tab", { name: "admin.exDraft.tab.topology" }))
    addCanvasContainer()
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.devices" }))
    fireEvent.click(screen.getByRole("button", { name: "host-1" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.interfaces" }))

    await waitFor(() => {
      const stored = window.localStorage.getItem("cybericebox.admin.exercise-draft.v1:editor-1")
      expect(stored).toContain("Recover me")
      expect(JSON.parse(stored!).position).toMatchObject({ tab: "variants", section: "topology", devicePanel: "interfaces" })
    })
    first.unmount()
    render(<NewExercisePage />)

    expect(await screen.findByRole("tab", { name: "admin.exDraft.tab.topology", selected: true })).toBeInTheDocument()
    fireEvent.contextMenu(screen.getByRole("button", { name: "host-1" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "admin.exTopo.configure" }))
    expect(screen.getByRole("button", { name: "admin.exTopo.interfaces" })).toHaveAttribute("aria-current", "page")
    fireEvent.click(screen.getByRole("tab", { name: "admin.ex.create.tab.general" }))
    expect(screen.getByLabelText(/admin.ex.field.name/)).toHaveValue("Recover me")
  })

  it("restores a tag still being typed without silently adding it", async () => {
    const first = render(<NewExercisePage />)
    fireEvent.change(screen.getByPlaceholderText("admin.ex.tagHint"), { target: { value: "pending-tag" } })
    await waitFor(() => expect(window.localStorage.getItem("cybericebox.admin.exercise-draft.v1:editor-1")).toContain("pending-tag"))
    first.unmount()
    render(<NewExercisePage />)
    expect(await screen.findByPlaceholderText("admin.ex.tagHint")).toHaveValue("pending-tag")
    expect(screen.queryByText("pending-tag", { selector: "span" })).not.toBeInTheDocument()
  })

  it("keeps a long variant note in a collapsed, scrollable inline editor", () => {
    render(<NewExercisePage />)
    fireEvent.mouseDown(screen.getByRole("tab", { name: "admin.ex.create.tab.variants" }), { button: 0 })
    const summary = screen.getByText("admin.exDraft.variantNoteShort").closest("summary") as HTMLElement
    expect(summary.closest("details")).not.toHaveAttribute("open")
    fireEvent.click(summary)
    const longNote = "Internal note describing the first variant in more than forty characters."
    const editor = screen.getByRole("textbox", { name: "admin.exDraft.variantNote" })
    expect(editor.tagName).toBe("TEXTAREA")
    fireEvent.change(editor, { target: { value: longNote } })
    expect(editor).toHaveValue(longNote)
    expect(editor).toHaveClass("overflow-y-auto")
    fireEvent.click(summary)
    expect(summary.closest("details")).not.toHaveAttribute("open")
  })

  it("flushes the browser draft without blocking reload", async () => {
    render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Unsaved work" } })
    const unload = new Event("beforeunload", { cancelable: true })
    fireEvent(window, unload)
    expect(unload.defaultPrevented).toBe(false)
    expect(window.localStorage.getItem("cybericebox.admin.exercise-draft.v1:editor-1")).toContain("Unsaved work")
  })

  it("asks before leaving and keeps the new browser draft", async () => {
    render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Leave and resume" } })
    fireEvent.click(screen.getByRole("link", { name: /admin.exDetail.back/ }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.ex.leaveNew.keep" }))
    expect(window.localStorage.getItem("cybericebox.admin.exercise-draft.v1:editor-1")).toContain("Leave and resume")
    expect(state.push).toHaveBeenCalledWith("/exercises")
  })

  it("clears the local copy and reload warning after a successful server save", async () => {
    mockCreate.mockResolvedValue({ ID: "new-exercise" } as Awaited<ReturnType<typeof createExercise>>)
    render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Saved exercise" } })
    fireEvent.change(screen.getByRole("textbox", { name: /admin.exTask.name/ }), { target: { value: "Find the flag" } })
    fireEvent.click(screen.getByRole("button", { name: "admin.ex.create.submit" }))
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/exercises/detail?id=new-exercise"))
    expect(window.localStorage.getItem("cybericebox.admin.exercise-draft.v1:editor-1")).toBeNull()
    const unload = new Event("beforeunload", { cancelable: true })
    fireEvent(window, unload)
    expect(unload.defaultPrevented).toBe(false)
  })

  it("remembers the server-created exercise when retrying after a reload", async () => {
    mockCreate.mockResolvedValue({ ID: "new-exercise" } as Awaited<ReturnType<typeof createExercise>>)
    mockSaveDraft.mockRejectedValueOnce(new ApiError(500, { Status: { Code: 500 } }))
    const first = render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "Partial exercise" } })
    fireEvent.change(screen.getByRole("textbox", { name: /admin.exTask.name/ }), { target: { value: "Find the flag" } })
    fireEvent.click(screen.getByRole("button", { name: "admin.ex.create.submit" }))
    expect(await screen.findByText("admin.ex.create.partialSave")).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem("cybericebox.admin.exercise-draft.v1:editor-1")!).createdId).toBe("new-exercise")
    first.unmount()

    render(<NewExercisePage />)
    expect(await screen.findByDisplayValue("Partial exercise")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.ex.create.submit" }))
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/exercises/detail?id=new-exercise"))
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith("new-exercise", expect.objectContaining({ Name: "Partial exercise" }))
  })

  it("disables the submit action while the create request is pending", async () => {
    let resolveCreate: ((value: Awaited<ReturnType<typeof createExercise>>) => void) | undefined
    mockCreate.mockImplementationOnce(() => new Promise((resolve) => { resolveCreate = resolve }))
    render(<NewExercisePage />)
    fireEvent.change(screen.getByLabelText(/admin.ex.field.name/), { target: { value: "New exercise" } })
    fireEvent.click(screen.getByRole("tab", { name: "admin.ex.create.tab.variants" }))
    fireEvent.change(screen.getByRole("textbox", { name: /admin.exTask.name/ }), { target: { value: "Find the flag" } })
    fireEvent.click(screen.getByRole("button", { name: "admin.ex.create.submit" }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledOnce())
    expect(screen.getByRole("button", { name: "admin.ex.create.submit" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "admin.ex.create.cancel" })).toBeDisabled()
    resolveCreate?.({ ID: "new-exercise" } as Awaited<ReturnType<typeof createExercise>>)
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/exercises/detail?id=new-exercise"))
  })
})
