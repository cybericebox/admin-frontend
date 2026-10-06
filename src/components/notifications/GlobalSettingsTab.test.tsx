import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock("@/api/client", () => ({ apiGet: api.get, apiPut: api.put }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/components/notifications/SignalDefaultsSection", () => ({ SignalDefaultsSection: () => null }))
const role = vi.hoisted(() => ({ canWrite: true }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => role.canWrite }) }))
const toastApi = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock("@/components/ui/toast", () => ({ toast: toastApi }))

import { GlobalSettingsTab } from "./GlobalSettingsTab"

const row = { NotificationType: "welcome", Channel: "email", Enabled: false, UserCanChange: false, UserDefault: false }

describe("GlobalSettingsTab saving", () => {
  beforeEach(() => {
    api.get.mockReset(); api.put.mockReset(); toastApi.success.mockReset(); toastApi.error.mockReset(); role.canWrite = true
    api.get.mockResolvedValue([row])
  })

  it("shows the switch at once and keeps the other switches enabled while the save is pending", async () => {
    let finish: () => void = () => {}
    api.put.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    render(<GlobalSettingsTab />)
    const switches = await screen.findAllByRole("switch")
    fireEvent.click(switches[0])
    expect(screen.getAllByRole("switch")[0]).toHaveAttribute("aria-checked", "true")
    screen.getAllByRole("switch").forEach((el) => expect(el).toBeEnabled())
    expect(screen.queryByText("admin.loading")).not.toBeInTheDocument()
    finish()
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
    expect(toastApi.success).not.toHaveBeenCalled()
  })

  it("queues quick changes to one row so the second save carries both", async () => {
    let finish: () => void = () => {}
    api.put.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve })).mockResolvedValue(undefined)
    render(<GlobalSettingsTab />)
    const switches = await screen.findAllByRole("switch")
    fireEvent.click(switches[0])
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getAllByRole("switch")[1])
    expect(api.put).toHaveBeenCalledTimes(1)
    finish()
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2))
    expect(api.put).toHaveBeenLastCalledWith("/api/notifications/settings/global", { ...row, Enabled: true, UserCanChange: true })
  })

  it("rolls back a failed save and shows an error toast", async () => {
    api.put.mockRejectedValueOnce(new Error("nope"))
    render(<GlobalSettingsTab />)
    fireEvent.click((await screen.findAllByRole("switch"))[0])
    await waitFor(() => expect(toastApi.error).toHaveBeenCalled())
    expect(screen.getAllByRole("switch")[0]).toHaveAttribute("aria-checked", "false")
  })

  it("names every switch by row and flag", async () => {
    render(<GlobalSettingsTab />)
    const switches = await screen.findAllByRole("switch")
    expect(switches).toHaveLength(3)
    switches.forEach((el) => expect(el).toHaveAccessibleName("admin.notif.settings.switchLabel"))
  })

  it("disables the switches without the write permission", async () => {
    role.canWrite = false
    render(<GlobalSettingsTab />)
    const switches = await screen.findAllByRole("switch")
    switches.forEach((el) => expect(el).toBeDisabled())
  })
})
