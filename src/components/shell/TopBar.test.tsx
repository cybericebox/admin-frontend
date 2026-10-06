import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { TopBar } from "./TopBar"

const role = vi.hoisted(() => ({ value: "admin_viewer" as string }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ role: role.value, me: { FirstName: "Іра", LastName: "К", Email: "i@k.test", Picture: "" }, can: () => true }) }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/api/client", () => ({ apiPost: vi.fn(), mediaUrl: (value: string) => value }))
vi.mock("@/lib/origins", () => ({ idOrigin: "https://id.test", exercisesOrigin: "https://ex.test" }))
vi.mock("./InboxButton", () => ({ InboxButton: () => <button>inbox</button> }))
vi.mock("@/components/consent/CookieSettingsMenuItem", () => ({ CookieSettingsMenuItem: () => null }))
vi.mock("@/components/FeedbackMenuItem", () => ({ FeedbackMenuItem: () => null }))

describe("top bar", () => {
  it("keeps the theme switch and the view-only badge in the bar from md up, and offers both in the account menu on narrow screens", () => {
    role.value = "admin_viewer"
    const { container } = render(<TopBar crumbs={[{ label: "Заходи" }]} />)
    // In the bar: hidden below md through a utility class.
    const barSwitch = screen.getByRole("radiogroup", { name: "theme.label" })
    expect(barSwitch.parentElement).toHaveClass("max-md:hidden")
    expect(container.querySelector("header span.max-md\\:hidden")).toHaveTextContent("admin.role.viewOnlyBadge")

    fireEvent.keyDown(screen.getByRole("button", { name: "admin.accountMenu" }), { key: "ArrowDown" })
    expect(screen.getByRole("menuitemradio", { name: "theme.dark" })).toBeInTheDocument()
    expect(screen.getAllByText("admin.role.viewOnlyBadge")).toHaveLength(2)
    fireEvent.click(screen.getByRole("menuitemradio", { name: "theme.dark" }))
    expect(document.documentElement.dataset.theme).toBe("dark")
  })

  it("shows the trail only: no h1, links on every crumb but the last", () => {
    role.value = "admin"
    render(<TopBar crumbs={[{ label: "Заходи", href: "/events" }, { label: "Новий захід" }]} />)
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Заходи" })).toHaveAttribute("href", "/events")
    expect(screen.getByText("Новий захід")).toHaveAttribute("aria-current", "page")
  })

  it("a top-level page shows its section as plain text, not a link to itself", () => {
    role.value = "admin"
    render(<TopBar crumbs={[{ label: "Головна" }]} />)
    expect(screen.getByText("Головна")).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("link", { name: "Головна" })).not.toBeInTheDocument()
  })
})
