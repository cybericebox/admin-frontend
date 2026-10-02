import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock("@/api/client", async (original) => ({ ...(await original<object>()), apiGet: mocks.get, apiPut: mocks.put, apiPost: mocks.post }))
vi.mock("@/i18n/t", () => ({ t: (key: string, vars?: Record<string, string | number>) => vars ? `${key} ${JSON.stringify(vars)}` : key }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

import { ErrorNotifySettings } from "./ErrorNotifySettings"

const settings = (over: object = {}) => ({ Emails: ["ops@example.test"], EmailToSuperAdmins: true, TelegramEnabled: true, TelegramChats: [{ ChatID: "-100", Label: "Ops", Failing: true, FailingSince: "2026-10-01T10:00:00Z", LastError: "bot was blocked" }], UpdatedAt: "2026-10-01T10:00:00Z", ...over })

describe("error notification settings", () => {
  beforeEach(() => { mocks.get.mockReset(); mocks.put.mockReset(); mocks.post.mockReset(); mocks.get.mockResolvedValue(settings()) })
  afterEach(cleanup)

  it("shows the lists, a failing chat and the missing-token hint", async () => {
    mocks.get.mockResolvedValue(settings({ TelegramEnabled: false }))
    render(<ErrorNotifySettings />)
    expect(await screen.findByDisplayValue("ops@example.test")).toBeInTheDocument()
    expect(screen.getByDisplayValue("-100")).toBeInTheDocument()
    expect(screen.getByText(/admin.errors.settings.chatFailing/)).toBeInTheDocument()
    expect(screen.getByText("admin.errors.settings.telegramOff")).toBeInTheDocument()
  })

  it("blocks saving a bad chat id or address and says why", async () => {
    render(<ErrorNotifySettings />)
    const chat = await screen.findByDisplayValue("-100")
    fireEvent.change(chat, { target: { value: "not-a-chat" } })
    expect(screen.getByText(/admin.errors.settings.chatInvalid/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "admin.errors.settings.save" })).toBeDisabled()
    fireEvent.change(chat, { target: { value: "@ops_alerts" } })
    expect(screen.getByRole("button", { name: "admin.errors.settings.save" })).toBeEnabled()
  })

  it("replaces both lists on save and keeps the editor in place", async () => {
    mocks.put.mockResolvedValue(settings({ Emails: ["ops@example.test", "new@example.test"] }))
    render(<ErrorNotifySettings />)
    await screen.findByDisplayValue("ops@example.test")
    fireEvent.click(screen.getByRole("button", { name: "admin.errors.settings.addEmail" }))
    fireEvent.change(screen.getByLabelText(/admin.errors.settings.emailN {"n":2}/), { target: { value: " new@example.test " } })
    fireEvent.click(screen.getByRole("button", { name: "admin.errors.settings.save" }))
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith("/api/admin/errors/settings", {
      Emails: ["ops@example.test", "new@example.test"], EmailToSuperAdmins: true, TelegramChats: [{ ChatID: "-100", Label: "Ops" }],
    }))
    expect(await screen.findByDisplayValue("new@example.test")).toBeInTheDocument()
  })

  it("sends a test and lists the result per target", async () => {
    mocks.post.mockResolvedValue({ Results: [{ Channel: "telegram", Target: "-100", Label: "Ops", OK: false, Error: "chat not found" }, { Channel: "email", Target: "ops@example.test", Label: "", OK: true, Error: "" }] })
    render(<ErrorNotifySettings />)
    await screen.findByDisplayValue("ops@example.test")
    fireEvent.click(screen.getByRole("button", { name: "admin.errors.settings.test" }))
    expect(await screen.findByText("chat not found")).toBeInTheDocument()
    expect(screen.getByText("admin.errors.settings.resultOk")).toBeInTheDocument()
    expect(mocks.post).toHaveBeenCalledWith("/api/admin/errors/settings/test", {})
  })
})
