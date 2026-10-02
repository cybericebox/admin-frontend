import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ApiError } from "@/api/client"
import { ELEVATION_PERM, type ElevationRequest } from "@/api/elevations"
import { ElevationsPage } from "./ElevationsPage"
import { ElevationDetail } from "./ElevationDetail"
import { deviceLevel, hasCeilingDevice } from "./elevationView"

const apiGet = vi.fn()
const apiPost = vi.fn()
let permissions: string[] = [ELEVATION_PERM]
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  apiGet: (...a: unknown[]) => apiGet(...a), apiPost: (...a: unknown[]) => apiPost(...a),
}))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (perm: string) => permissions.includes(perm) }) }))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

const request = (over: Partial<ElevationRequest> = {}): ElevationRequest => ({
  ID: "r1", ExerciseID: "e1", ExerciseName: "SQL injection", Status: "pending", Reason: "Needs a database", RequestedByName: "Олена",
  RequestedAt: "2026-10-02T10:00:00Z", ReviewedByName: "", ReviewedAt: null, ReviewNote: "",
  Devices: [{ DeviceID: "d1", DeviceName: "db", Variant: 1, CPU: "500m", Memory: "2Gi" }], ...over,
})

beforeEach(() => {
  apiGet.mockReset(); apiPost.mockReset()
  permissions = [ELEVATION_PERM]
})

describe("elevation view helpers", () => {
  it("marks devices above the ceiling", () => {
    expect(deviceLevel({ DeviceID: "d", DeviceName: "d", Variant: 1, CPU: "500m", Memory: "2Gi" })).toBe("elevated")
    expect(deviceLevel({ DeviceID: "d", DeviceName: "d", Variant: 1, CPU: "2", Memory: "1Gi" })).toBe("ceiling")
    expect(deviceLevel({ DeviceID: "d", DeviceName: "d", Variant: 1, CPU: "1", Memory: "8Gi" })).toBe("ceiling")
    expect(hasCeilingDevice(request().Devices)).toBe(false)
  })
})

describe("elevations list", () => {
  it("lists pending requests with author, date, device count and status", async () => {
    apiGet.mockResolvedValue({ Items: [request(), request({ ID: "r2", ExerciseName: "XSS", Devices: [] })] })
    render(<ElevationsPage />)
    const row = await screen.findByTestId("elevation-r1")
    expect(within(row).getByText("SQL injection")).toBeInTheDocument()
    expect(within(row).getByText(/Олена/)).toBeInTheDocument()
    expect(within(row).getByText("Пристроїв: 1")).toBeInTheDocument()
    expect(within(row).getByText("Очікує")).toBeInTheDocument()
    expect(within(row).getByRole("link")).toHaveAttribute("href", "/elevations/detail?id=r1")
    expect(apiGet).toHaveBeenCalledWith("/api/exercises/elevations?status=pending")
  })

  it("switches to decided requests", async () => {
    apiGet.mockResolvedValue({ Items: [] })
    render(<ElevationsPage />)
    expect(await screen.findByText("Немає запитів, що очікують рішення")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Розглянуті" }))
    expect(await screen.findByText("Розглянутих запитів ще немає")).toBeInTheDocument()
    expect(apiGet).toHaveBeenLastCalledWith("/api/exercises/elevations?status=decided")
  })

  it("shows the centered load error with a retry", async () => {
    apiGet.mockRejectedValueOnce(new Error("down")).mockResolvedValue({ Items: [] })
    render(<ElevationsPage />)
    fireEvent.click(await screen.findByRole("button", { name: /Спробувати ще раз/ }))
    expect(await screen.findByText("Немає запитів, що очікують рішення")).toBeInTheDocument()
  })
})

describe("elevation detail", () => {
  it("shows the reason, the requested values and the device list", async () => {
    apiGet.mockResolvedValue(request())
    render(<ElevationDetail id="r1" />)
    expect(await screen.findByTestId("elevation-reason")).toHaveTextContent("Needs a database")
    const table = screen.getByTestId("elevation-devices")
    expect(within(table).getByText("db")).toBeInTheDocument()
    expect(within(table).getByText("500m")).toBeInTheDocument()
    expect(within(table).getByText("2Gi")).toBeInTheDocument()
  })

  it("approves through the confirm dialog", async () => {
    apiGet.mockResolvedValue(request())
    apiPost.mockResolvedValue(request({ Status: "approved", ReviewedByName: "Адмін" }))
    render(<ElevationDetail id="r1" />)
    fireEvent.click(await screen.findByRole("button", { name: "Погодити" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText(/Коментар/), { target: { value: " ok " } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Погодити" }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/exercises/elevations/r1/approve", { Note: "ok" }))
    await waitFor(() => expect(screen.getByText("Погоджено")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: "Відхилити" })).toBeNull()
  })

  it("rejects with a danger confirm and shows a failure inside the dialog", async () => {
    apiGet.mockResolvedValue(request())
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
    apiGet.mockResolvedValue(request())
    render(<ElevationDetail id="r1" />)
    expect(await screen.findByText("У вас немає права розглядати запити.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Погодити" })).toBeNull()
  })

  it("blocks approval above the platform ceiling", async () => {
    apiGet.mockResolvedValue(request({ Devices: [{ DeviceID: "d1", DeviceName: "db", Variant: 1, CPU: "2", Memory: "2Gi" }] }))
    render(<ElevationDetail id="r1" />)
    expect(await screen.findByRole("button", { name: "Погодити" })).toBeDisabled()
    expect(screen.getByTestId("elevation-devices").querySelector("[data-level='ceiling']")).toBeInTheDocument()
  })

  it("shows the outcome of a decided request", async () => {
    apiGet.mockResolvedValue(request({ Status: "rejected", ReviewedByName: "Адмін", ReviewNote: "Too much", ReviewedAt: "2026-10-02T11:00:00Z" }))
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
