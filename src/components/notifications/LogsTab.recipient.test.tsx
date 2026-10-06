import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

vi.mock("@/api/client", () => ({ apiGet: vi.fn() }))
vi.mock("@/lib/userNames", () => ({ useUserNames: () => ({}) }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => false }) }))
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))

import { apiGet } from "@/api/client"
import { LogsTab } from "./LogsTab"

const base = { RecipientUserID: "11111111-1111-1111-1111-111111111111", Status: "done", CreatedAt: "2026-06-01T00:00:00Z", UpdatedAt: "2026-06-01T00:00:00Z", NotificationType: "user.welcome" }
const row = { ...base, ID: "d1", RecipientName: "Ann Lee", RecipientEmail: "ann@example.com" }
const detail = {
  ...row,
  Targets: [
    { Channel: "in_app", Status: "done", Error: "", Attempts: 1, Recipient: "ann@example.com", RecipientName: "Ann Lee", UpdatedAt: "" },
    { Channel: "email", Status: "done", Error: "", Attempts: 1, Recipient: "bob@example.com", RecipientName: "", UpdatedAt: "" },
    { Channel: "email", Status: "error", Attempts: 1, Error: "535 5.7.8 bad creds", ErrorKind: "smtp_auth", ErrorCode: "535", FallbackError: "dial tcp: timeout", FallbackErrorKind: "smtp_connect", FallbackErrorCode: "", UpdatedAt: "" },
    { Channel: "email", Status: "deferred", Error: "Відкладено: ліміт", ErrorKind: "", UpdatedAt: "", Attempts: 0 },
  ],
}

let detailOverride: Record<string, unknown> | null = null

beforeEach(() => {
  detailOverride = null
  vi.mocked(apiGet).mockImplementation((url: string) => {
    if (url.startsWith("/api/notifications/dispatches/")) return Promise.resolve(detailOverride ?? detail)
    return Promise.resolve({ Items: [row], Total: 1 })
  })
})

describe("LogsTab recipient and error lines", () => {
  it("shows the recipient name in the journal row when the name cache has nothing", async () => {
    render(<LogsTab />)
    expect(await screen.findByText("Ann Lee")).toBeInTheDocument()
    expect(screen.getByText("ann@example.com")).toBeInTheDocument()
  })

  it("shows one recipient row on top as a user link, none in channel cards, humanized errors", async () => {
    render(<LogsTab />)
    fireEvent.click((await screen.findByText("Ann Lee")).closest("tr")!)
    const dialog = await screen.findByRole("dialog")
    const link = await within(dialog).findByRole("link", { name: "Ann Lee (ann@example.com)" })
    expect(link).toHaveAttribute("href", "/users/detail?id=11111111-1111-1111-1111-111111111111")
    expect(within(dialog).getAllByText("Одержувач:")).toHaveLength(1)
    expect(within(dialog).queryByText("bob@example.com")).toBeNull()

    expect(within(dialog).getByText(/SMTP-сервер відхилив вхід/)).toBeInTheDocument()
    expect(within(dialog).getByText("535 5.7.8 bad creds")).toBeInTheDocument()
    expect(within(dialog).getByText(/Не вдалося зʼєднатися з SMTP-сервером/)).toBeInTheDocument()
    expect(within(dialog).getAllByText("Технічні деталі")).toHaveLength(2)
    expect(within(dialog).getByText(/Відкладено: ліміт/)).toBeInTheDocument()
  })

  it.each([
    ["nil uuid", "00000000-0000-0000-0000-000000000000"],
    ["empty id", ""],
  ])("shows the recipient as plain text without a link for %s", async (_n, id) => {
    detailOverride = { ...detail, RecipientUserID: id, RecipientName: "", RecipientEmail: "ann@example.com" }
    render(<LogsTab />)
    fireEvent.click((await screen.findByText("Ann Lee")).closest("tr")!)
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText("ann@example.com")).toBeInTheDocument()
    expect(within(dialog).queryByRole("link")).toBeNull()
  })

  it("shows a dash when the dispatch has neither name nor email", async () => {
    detailOverride = { ...detail, RecipientName: "", RecipientEmail: "" }
    render(<LogsTab />)
    fireEvent.click((await screen.findByText("Ann Lee")).closest("tr")!)
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText("—")).toBeInTheDocument()
    expect(within(dialog).queryByRole("link")).toBeNull()
  })

  it("humanizes the raw gomail 530 error from the backend (smtp_auth / 530)", async () => {
    const raw = "email: failed to send: gomail: could not send email 1: 530 Authentication required"
    detailOverride = { ...detail, Targets: [{ Channel: "email", Status: "error", Attempts: 1, Error: raw, ErrorKind: "smtp_auth", ErrorCode: "530", UpdatedAt: "" }] }
    render(<LogsTab />)
    fireEvent.click((await screen.findByText("Ann Lee")).closest("tr")!)
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText(/SMTP-сервер відхилив вхід: перевірте логін і пароль SMTP/)).toBeInTheDocument()
    expect(within(dialog).getByText("Технічні деталі")).toBeInTheDocument()
    expect(within(dialog).getByText(raw)).toBeInTheDocument()
  })
})
