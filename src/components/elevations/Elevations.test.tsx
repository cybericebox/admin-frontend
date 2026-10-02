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

const request = (over: Partial<ElevationRequest> = {}): ElevationRequest => ({
  ID: "r1", ExerciseID: "e1", ExerciseName: "SQL injection", Status: "pending", Reason: "Needs a database", RequestedByName: "Олена",
  RequestedAt: "2026-10-02T10:00:00Z", DecidedByName: "", DecidedAt: null, DecisionNote: "", VersionID: "v1", Approved: [],
  Requested: [{ DeviceID: "d1", Name: "db", CPUMillicores: 500, MemoryBytes: 2 * 1024 ** 3 }], ...over,
})

beforeEach(() => {
  apiGet.mockReset(); apiPost.mockReset()
  permissions = [ELEVATION_READ_PERM, ELEVATION_WRITE_PERM]
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
    expect(apiGet).toHaveBeenCalledWith("/api/exercises/resource-elevations?status=pending")
  })

  it("filters by status; «Усі» sends no status", async () => {
    apiGet.mockResolvedValue([])
    render(<ElevationsPage />)
    expect(await screen.findByText("Немає запитів, що очікують рішення")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Відхилені" }))
    expect(await screen.findByText("Відхилених запитів ще немає")).toBeInTheDocument()
    expect(apiGet).toHaveBeenLastCalledWith("/api/exercises/resource-elevations?status=rejected")
    fireEvent.click(screen.getByRole("tab", { name: "Усі" }))
    expect(await screen.findByText("Запитів ще немає")).toBeInTheDocument()
    expect(apiGet).toHaveBeenLastCalledWith("/api/exercises/resource-elevations")
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
    apiGet.mockResolvedValue([request()])
    render(<ElevationDetail id="r1" />)
    expect(await screen.findByTestId("elevation-reason")).toHaveTextContent("Needs a database")
    const table = screen.getByTestId("elevation-devices")
    expect(within(table).getByText("db")).toBeInTheDocument()
    expect(within(table).getByLabelText(/^CPU для «db»/)).toHaveValue("500")
    expect(within(table).getByLabelText(/^Памʼять для «db»/)).toHaveValue("2048")
  })

  it("approves through the confirm dialog", async () => {
    apiGet.mockResolvedValue([request()])
    apiPost.mockResolvedValue(request({ Status: "approved", DecidedByName: "Адмін" }))
    render(<ElevationDetail id="r1" />)
    fireEvent.click(await screen.findByRole("button", { name: "Погодити" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText(/Коментар/), { target: { value: " ok " } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Погодити" }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/exercises/resource-elevations/r1/decide", { Approve: true, Note: "ok" }))
    await waitFor(() => expect(screen.getByText("Погоджено")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: "Відхилити" })).toBeNull()
  })

  it("approves with lowered values, sends Devices only then and says so in the dialog", async () => {
    apiGet.mockResolvedValue([request()])
    apiPost.mockResolvedValue(request({ Status: "approved" }))
    render(<ElevationDetail id="r1" />)
    fireEvent.change(await screen.findByLabelText(/^CPU для «db»/), { target: { value: "300" } })
    fireEvent.click(screen.getByRole("button", { name: "Погодити" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByTestId("elevation-reduced")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Погодити" }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/exercises/resource-elevations/r1/decide", {
      Approve: true, Note: "", Devices: [{ DeviceID: "d1", CPUMillicores: 300, MemoryBytes: 2 * 1024 ** 3 }],
    }))
  })

  it("lowers memory in MiB", async () => {
    apiGet.mockResolvedValue([request()])
    apiPost.mockResolvedValue(request({ Status: "approved" }))
    render(<ElevationDetail id="r1" />)
    fireEvent.change(await screen.findByLabelText(/^Памʼять для «db»/), { target: { value: "1024" } })
    fireEvent.click(screen.getByRole("button", { name: "Погодити" }))
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Погодити" }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ Devices: [{ DeviceID: "d1", CPUMillicores: 500, MemoryBytes: 1024 ** 3 }] })))
  })

  it("does not allow values above the request or empty ones", async () => {
    apiGet.mockResolvedValue([request()])
    render(<ElevationDetail id="r1" />)
    const cpu = await screen.findByLabelText(/^CPU для «db»/)
    fireEvent.change(cpu, { target: { value: "600" } })
    expect(screen.getByRole("button", { name: "Погодити" })).toBeDisabled()
    expect(screen.getByTestId("elevation-edit-hint")).toHaveTextContent("додатними")
    fireEvent.change(cpu, { target: { value: "" } })
    expect(screen.getByRole("button", { name: "Погодити" })).toBeDisabled()
    fireEvent.change(cpu, { target: { value: "1" } })
    expect(screen.getByRole("button", { name: "Погодити" })).toBeEnabled()
  })

  it("rejects with a danger confirm and shows a failure inside the dialog", async () => {
    apiGet.mockResolvedValue([request()])
    apiPost.mockRejectedValue(new ApiError(500, "boom"))
    render(<ElevationDetail id="r1" />)
    fireEvent.click(await screen.findByRole("button", { name: "Відхилити" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Відхилити" }))
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument()
    expect(apiPost).toHaveBeenCalledWith("/api/exercises/resource-elevations/r1/decide", { Approve: false, Note: "" })
  })

  it("hides the decision without the permission", async () => {
    permissions = []
    apiGet.mockResolvedValue([request()])
    render(<ElevationDetail id="r1" />)
    expect(await screen.findByText("У вас немає права розглядати запити.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Погодити" })).toBeNull()
  })

  it("shows the outcome of a decided request", async () => {
    apiGet.mockResolvedValue([request({ Status: "rejected", DecidedByName: "Адмін", DecisionNote: "Too much", DecidedAt: "2026-10-02T11:00:00Z" })])
    render(<ElevationDetail id="r1" />)
    expect(await screen.findByText("Too much")).toBeInTheDocument()
    expect(screen.getByText("Відхилено")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Погодити" })).toBeNull()
  })

  it("shows not found for a missing request", async () => {
    apiGet.mockResolvedValue([request()])
    render(<ElevationDetail id="missing" />)
    expect(await screen.findByText("Запит не знайдено")).toBeInTheDocument()
  })
})
