import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ApiError } from "@/api/client"
import { ELEVATION_READ_PERM, ELEVATION_WRITE_PERM, type ElevationRequest } from "@/api/elevations"
import { ElevationsPage } from "./ElevationsPage"
import { ElevationDetail } from "./ElevationDetail"

const apiGet = vi.fn()
const apiPost = vi.fn()
let permissions: string[] = [ELEVATION_READ_PERM, ELEVATION_WRITE_PERM]
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  apiGet: (...a: unknown[]) => apiGet(...a), apiPost: (...a: unknown[]) => apiPost(...a),
}))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (perm: string) => permissions.includes(perm) }) }))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

const presets = [
  { ID: "nano", Blocks: 1, CPUMillicores: 7, MemoryBytes: 32 * 1024 ** 2 },
  { ID: "micro", Blocks: 2, CPUMillicores: 15, MemoryBytes: 64 * 1024 ** 2 },
  { ID: "small", Blocks: 4, CPUMillicores: 31, MemoryBytes: 128 * 1024 ** 2 },
  { ID: "standard", Blocks: 8, CPUMillicores: 62, MemoryBytes: 256 * 1024 ** 2 },
  { ID: "medium", Blocks: 16, CPUMillicores: 125, MemoryBytes: 512 * 1024 ** 2 },
  { ID: "large", Blocks: 32, CPUMillicores: 250, MemoryBytes: 1024 ** 3 },
  { ID: "xlarge", Blocks: 64, CPUMillicores: 500, MemoryBytes: 2 * 1024 ** 3 },
  { ID: "max", Blocks: 128, CPUMillicores: 1000, MemoryBytes: 4 * 1024 ** 3 },
]
/** Capabilities answer on its own path; everything else gets the given value. */
const serve = (value: unknown) => apiGet.mockImplementation((path: string) =>
  path === "/api/exercises/capabilities" ? Promise.resolve({ Resources: { Presets: presets } }) : Promise.resolve(value))

const request = (over: Partial<ElevationRequest> = {}): ElevationRequest => ({
  ID: "r1", ExerciseID: "e1", ExerciseName: "SQL injection", Status: "pending", Reason: "Needs a database", RequestedByName: "Олена",
  RequestedAt: "2026-10-02T10:00:00Z", DecidedByName: "", DecidedAt: null, DecisionNote: "", VersionID: "v1", Approved: [],
  Requested: [{ DeviceID: "d1", Name: "db", Blocks: 64, CPUMillicores: 500, MemoryBytes: 2 * 1024 ** 3 }], ...over,
})

beforeEach(() => {
  apiGet.mockReset(); apiPost.mockReset()
  permissions = [ELEVATION_READ_PERM, ELEVATION_WRITE_PERM]
  window.history.replaceState(null, "", "/elevations/")
})

describe("elevations list", () => {
  it("lists pending requests with author, date, device count and status", async () => {
    apiGet.mockResolvedValue([request(), request({ ID: "r2", ExerciseName: "XSS", Requested: [] })])
    render(<ElevationsPage />)
    const row = await screen.findByTestId("elevation-r1")
    expect(within(row).getByText("SQL injection")).toBeInTheDocument()
    expect(within(row).getByText(/Олена/)).toBeInTheDocument()
    expect(within(row).getByText("Пристроїв: 1")).toBeInTheDocument()
    expect(within(row).getByText("Очікує")).toBeInTheDocument()
    expect(within(row).getByRole("link")).toHaveAttribute("href", "/elevations/detail?id=r1")
    expect(apiGet).toHaveBeenCalledWith("/api/exercises/elevations?status=pending")
  })

  it("filters by status; «Усі» sends no status", async () => {
    apiGet.mockResolvedValue([])
    render(<ElevationsPage />)
    expect(await screen.findByText("Немає запитів, що очікують рішення")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: "Відхилені" }))
    expect(await screen.findByText("Відхилених запитів ще немає")).toBeInTheDocument()
    expect(apiGet).toHaveBeenLastCalledWith("/api/exercises/elevations?status=rejected")
    fireEvent.click(screen.getByRole("radio", { name: "Усі" }))
    expect(await screen.findByText("Запитів ще немає")).toBeInTheDocument()
    expect(apiGet).toHaveBeenLastCalledWith("/api/exercises/elevations")
  })

  it("shows the centered load error with a retry", async () => {
    apiGet.mockRejectedValueOnce(new Error("down")).mockResolvedValue([])
    render(<ElevationsPage />)
    fireEvent.click(await screen.findByRole("button", { name: /Спробувати ще раз/ }))
    expect(await screen.findByText("Немає запитів, що очікують рішення")).toBeInTheDocument()
  })
})

describe("elevation detail", () => {
  it("shows the reason, the requested values and the device list", async () => {
    serve(request())
    render(<ElevationDetail id="r1" />)
    expect(await screen.findByTestId("elevation-reason")).toHaveTextContent("Needs a database")
    expect(apiGet).toHaveBeenCalledWith("/api/exercises/elevations/r1")
    const table = screen.getByTestId("elevation-devices")
    expect(within(table).getByText("db")).toBeInTheDocument()
    expect(within(table).getByText("Дуже великий")).toBeInTheDocument()
    const select = await within(table).findByLabelText(/^Розмір для «db»/)
    expect(select).toHaveValue("64")
    // Only the requested block and smaller ones are offered.
    expect(within(select).getAllByRole("option").map((option) => (option as HTMLOptionElement).value)).toEqual(["1", "2", "4", "8", "16", "32", "64"])
  })

  it("approves through the confirm dialog", async () => {
    serve(request())
    apiPost.mockResolvedValue(request({ Status: "approved", DecidedByName: "Адмін" }))
    render(<ElevationDetail id="r1" />)
    fireEvent.click(await screen.findByRole("button", { name: "Погодити" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText(/Коментар/), { target: { value: " ok " } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Погодити" }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/exercises/elevations/r1/approve", { Note: "ok" }))
    await waitFor(() => expect(screen.getByText("Погоджено")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: "Відхилити" })).toBeNull()
  })

  it("approves with a smaller block, sends Devices only then and says so in the dialog", async () => {
    serve(request())
    apiPost.mockResolvedValue(request({ Status: "approved" }))
    render(<ElevationDetail id="r1" />)
    fireEvent.change(await screen.findByLabelText(/^Розмір для «db»/), { target: { value: "16" } })
    fireEvent.click(screen.getByRole("button", { name: "Погодити" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByTestId("elevation-reduced")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Погодити" }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/exercises/elevations/r1/approve", {
      Note: "", Devices: [{ DeviceID: "d1", Blocks: 16 }],
    }))
  })

  it("never offers a block above the request, even for a small request", async () => {
    serve(request({ Requested: [{ DeviceID: "d1", Name: "db", Blocks: 4, CPUMillicores: 31, MemoryBytes: 128 * 1024 ** 2 }] }))
    render(<ElevationDetail id="r1" />)
    const select = await screen.findByLabelText(/^Розмір для «db»/)
    expect(within(select).getAllByRole("option").map((option) => (option as HTMLOptionElement).value)).toEqual(["1", "2", "4"])
    expect(select).toHaveValue("4")
  })

  it("rejects with a danger confirm and shows a failure inside the dialog", async () => {
    serve(request())
    apiPost.mockRejectedValue(new ApiError(500, "boom"))
    render(<ElevationDetail id="r1" />)
    fireEvent.click(await screen.findByRole("button", { name: "Відхилити" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Відхилити" }))
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument()
    expect(apiPost).toHaveBeenCalledWith("/api/exercises/elevations/r1/reject", { Note: "" })
  })

  it("hides the decision without the permission", async () => {
    permissions = []
    serve(request())
    render(<ElevationDetail id="r1" />)
    expect(await screen.findByText("У вас немає права розглядати запити.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Погодити" })).toBeNull()
  })

  it("shows the outcome of a decided request", async () => {
    serve(request({ Status: "rejected", DecidedByName: "Адмін", DecisionNote: "Too much", DecidedAt: "2026-10-02T11:00:00Z" }))
    render(<ElevationDetail id="r1" />)
    expect(await screen.findByText("Too much")).toBeInTheDocument()
    expect(screen.getByText("Відхилено")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Погодити" })).toBeNull()
  })

  it("shows not found for a missing request", async () => {
    apiGet.mockRejectedValue(new ApiError(404, "no"))
    render(<ElevationDetail id="missing" />)
    expect(await screen.findByText("Запит не знайдено")).toBeInTheDocument()
  })
})
