import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

vi.mock("@/api/client", () => ({ apiGet: vi.fn() }))
vi.mock("@/lib/userNames", () => ({ useUserNames: () => ({}) }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => false }) }))
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))

import { apiGet } from "@/api/client"
import { LogsTab } from "./LogsTab"

const base = { RecipientUserID: "u1", Status: "done", CreatedAt: "2026-06-01T00:00:00Z", UpdatedAt: "2026-06-01T00:00:00Z", NotificationType: "user.welcome" }
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

beforeEach(() => {
  vi.mocked(apiGet).mockImplementation((url: string) => {
    if (url.startsWith("/api/notifications/dispatches/")) return Promise.resolve(detail)
    return Promise.resolve({ Items: [row], Total: 1 })
  })
})

describe("LogsTab recipient and error lines", () => {
  it("shows the recipient name in the journal row when the name cache has nothing", async () => {
    render(<LogsTab />)
    expect(await screen.findByText("Ann Lee")).toBeInTheDocument()
    expect(screen.getByText("ann@example.com")).toBeInTheDocument()
  })

  it("shows name + email for in_app, email only without a name, humanized errors with technical details", async () => {
    render(<LogsTab />)
    fireEvent.click((await screen.findByText("Ann Lee")).closest("tr")!)
    const dialog = await screen.findByRole("dialog")
    await waitFor(() => expect(within(dialog).getAllByText("Одержувач:").length).toBe(2))
    const [inApp, mail] = within(dialog).getAllByText("Одержувач:").map((label) => label.parentElement!)
    expect(within(inApp).getByText("Ann Lee")).toBeInTheDocument()
    expect(within(inApp).getByText("ann@example.com")).toHaveClass("text-muted-foreground")
    expect(within(mail).queryByText("Ann Lee")).toBeNull()
    expect(within(mail).getByText("bob@example.com")).toBeInTheDocument()

    expect(within(dialog).getByText(/SMTP-сервер відхилив вхід/)).toBeInTheDocument()
    expect(within(dialog).getByText("535 5.7.8 bad creds")).toBeInTheDocument()
    expect(within(dialog).getByText(/Не вдалося з'єднатися з SMTP-сервером/)).toBeInTheDocument()
    expect(within(dialog).getAllByText("Технічні деталі")).toHaveLength(2)
    // A deferred text (no kind) is shown as is, without technical details.
    expect(within(dialog).getByText(/Відкладено: ліміт/)).toBeInTheDocument()
  })
})
