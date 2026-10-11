import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SettingsTab } from "./SettingsTab"

const mocks = vi.hoisted(() => ({ settings: vi.fn(), capacity: vi.fn(), put: vi.fn() }))
vi.mock("@/api/resourceCalendar", () => ({ getSettings: mocks.settings, getCapacity: mocks.capacity, putSettings: mocks.put }))
const settings = { TestPool: { CPUMillicores: 100, MemoryBytes: 64 * 1024 ** 2 } }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.settings.mockResolvedValue(settings)
  mocks.capacity.mockResolvedValue({ Total: { CPUMillicores: 1000, MemoryBytes: 1024 ** 3 }, Agents: [] })
})

describe("test pool settings Save", () => {
  it("ignores equivalent and reverted amounts and guards submitting a clean form", async () => {
    render(<SettingsTab canWrite onSaved={() => {}} />)
    const input = await screen.findByDisplayValue("100")
    expect(screen.queryByRole("button", { name: "Зберегти" })).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: "0100" } })
    expect(input).toHaveValue("0100")
    expect(screen.queryByRole("button", { name: "Зберегти" })).not.toBeInTheDocument()
    fireEvent.submit(input.closest("form")!)
    expect(mocks.put).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: "200" } })
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeEnabled()
    fireEvent.change(input, { target: { value: "100" } })
    expect(screen.queryByRole("button", { name: "Зберегти" })).not.toBeInTheDocument()
  })

  it("keeps a newer amount while an earlier save is pending and acknowledged", async () => {
    let resolve!: (value: unknown) => void
    mocks.put.mockReturnValue(new Promise((done) => { resolve = done }))
    render(<SettingsTab canWrite onSaved={() => {}} />)
    const input = await screen.findByDisplayValue("100")
    fireEvent.change(input, { target: { value: "200" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    expect(input).toBeEnabled()
    fireEvent.change(input, { target: { value: "300" } })
    resolve({ Settings: { TestPool: { ...settings.TestPool, CPUMillicores: 200 } }, Conflicts: [] })
    await waitFor(() => expect(screen.getByRole("button", { name: "Зберегти" })).toBeEnabled())
    expect(input).toHaveValue("300")
  })
})
