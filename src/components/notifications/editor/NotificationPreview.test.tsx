import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { NotificationPreview } from "./NotificationPreview"
vi.mock("@/api/notifications/emailTemplates", () => ({ previewEmailTemplate: vi.fn().mockResolvedValue({ Subject: "Hello", Preheader: "", HTML: "<p>Hello</p>" }) }))
const inApp = { title: "Hello {{Name}}", body: "Body", link: "", icon: "bell", tone: "neutral", accentColor: "", surface: "inbox", autoDismissMs: null, actions: [], previewValues: { Name: "Alex" } }
describe("notification preview channels", () => {
  it("shows one available preview at a time and uses the real toast card", () => {
    render(<NotificationPreview email={{ notificationType: "broadcast", body: [], styling: {} }} inApp={inApp} />)
    expect(screen.getAllByRole("tab")).toHaveLength(3)
    expect(screen.getByRole("tab", { name: "Лист" })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryAllByText("Hello Alex").every((node) => node.closest("[hidden]"))).toBe(true)
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Спливаюче повідомлення" }), { button: 0, ctrlKey: false })
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Hello Alex")
    expect(screen.getByRole("button", { name: "Закрити сповіщення" })).toBeInTheDocument()
  })
  it("preserves the email frame and viewport while visiting other channels", () => {
    render(<NotificationPreview email={{ notificationType: "broadcast", body: [], styling: {} }} inApp={inApp} />)
    fireEvent.click(screen.getByRole("button", { name: "Телефон" }))
    const frame = document.querySelector("iframe")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Стрічка сповіщень" }), { button: 0, ctrlKey: false })
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Лист" }), { button: 0, ctrlKey: false })
    expect(document.querySelector("iframe")).toBe(frame)
    expect(frame).toHaveStyle({ width: "390px" })
  })
  it("falls back to a remaining channel when the selected channel is removed", () => {
    const { rerender } = render(<NotificationPreview email={{ notificationType: "broadcast", body: [], styling: {} }} inApp={inApp} />)
    rerender(<NotificationPreview inApp={inApp} />)
    expect(screen.queryByRole("tab", { name: "Лист" })).toBeNull()
    expect(screen.getByRole("tab", { name: "Стрічка сповіщень" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Hello Alex")
  })
})
