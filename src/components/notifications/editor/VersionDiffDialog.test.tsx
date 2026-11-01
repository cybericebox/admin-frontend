import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const api = vi.hoisted(() => ({ email: vi.fn(), inApp: vi.fn() }))
vi.mock("@/api/notifications/emailTemplates", () => ({ getEmailTemplate: api.email }))
vi.mock("@/api/notifications/inAppTemplates", () => ({ getInAppTemplate: api.inApp }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
import { VersionDiffDialog } from "./VersionDiffDialog"

const email = (subject: string) => ({ Subject: subject, Preheader: "", Body: [] })

beforeEach(() => vi.clearAllMocks())

describe("VersionDiffDialog", () => {
  it("shows what the chosen version has that the current one lacks and what the current one adds", async () => {
    api.email.mockImplementation((id: string) => Promise.resolve(email(id === "old" ? "Old subject" : "New subject")))
    const { container } = render(<VersionDiffDialog channel="email" versionId="old" currentId="cur" onClose={() => undefined} />)
    expect(await screen.findByText(/Old subject/)).toBeInTheDocument()
    expect(container.ownerDocument.querySelector('[data-kind="removed"]')?.textContent).toContain("Old subject")
    expect(container.ownerDocument.querySelector('[data-kind="added"]')?.textContent).toContain("New subject")
  })
  it("says so when the two versions are the same", async () => {
    api.inApp.mockResolvedValue({ Title: "T", Body: "B", Link: "" })
    render(<VersionDiffDialog channel="in-app" versionId="old" currentId="cur" onClose={() => undefined} />)
    expect(await screen.findByText("admin.notif.diff.same")).toBeInTheDocument()
  })
  it("offers a retry when a version cannot be loaded", async () => {
    api.email.mockRejectedValue(new Error("offline"))
    render(<VersionDiffDialog channel="email" versionId="old" currentId="cur" onClose={() => undefined} />)
    expect(await screen.findByText("admin.notif.diff.loadError")).toBeInTheDocument()
  })
})
