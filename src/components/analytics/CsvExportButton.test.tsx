import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CsvExportButton } from "./CsvExportButton"

const mocks = vi.hoisted(() => ({ apiGetBlob: vi.fn(), toastError: vi.fn() }))
vi.mock("@/api/client", () => ({ apiGetBlob: mocks.apiGetBlob, apiGet: vi.fn(), ApiError: class extends Error {} }))
vi.mock("@/components/ui/toast", () => ({ toast: { error: mocks.toastError } }))

beforeEach(() => {
  mocks.apiGetBlob.mockReset(); mocks.toastError.mockReset()
  URL.createObjectURL = vi.fn(() => "blob:x"); URL.revokeObjectURL = vi.fn()
})

describe("CsvExportButton", () => {
  it("fetches the export url as a blob and downloads it, with the crest while busy", async () => {
    let resolve!: (value: unknown) => void
    mocks.apiGetBlob.mockReturnValue(new Promise((r) => { resolve = r }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    render(<CsvExportButton section="users" table="registrations" params={{ from: "2026-01-01T00:00:00Z" }} />)
    fireEvent.click(screen.getByRole("button", { name: /Експорт CSV/ }))
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(mocks.apiGetBlob).toHaveBeenCalledWith("/api/analytics/users/export.csv?from=2026-01-01T00%3A00%3A00Z&table=registrations")
    resolve({ blob: new Blob(["a"]), filename: "users.csv" })
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(URL.createObjectURL).toHaveBeenCalled()
    click.mockRestore()
  })
  it("reports a failed export", async () => {
    mocks.apiGetBlob.mockRejectedValue(new Error("no"))
    render(<CsvExportButton section="users" table="t" />)
    fireEvent.click(screen.getByRole("button"))
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Не вдалося завантажити CSV"))
  })
})
