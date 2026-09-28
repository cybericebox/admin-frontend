import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { Sidebar } from "./Sidebar"

vi.mock("next/navigation", () => ({ usePathname: () => "/events" }))
const rights = vi.hoisted(() => ({ infrastructure: true }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (permission: string) => permission !== "platform.settings.read" && (permission !== "infrastructure.read" || rights.infrastructure) }) }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/components/brand/Logo", () => ({ Logo: () => <span>crest</span> }))

describe("admin sidebar", () => {
  beforeEach(() => { rights.infrastructure = true })
  it("links to available administration sections and respects permissions", () => {
    render(<Sidebar />)
    expect(screen.getByRole("link", { name: "admin.nav.events" })).toHaveAttribute("href", "/events")
    expect(screen.getByRole("link", { name: "admin.nav.labs" })).toHaveAttribute("href", "/labs")
    expect(screen.getByRole("link", { name: "admin.nav.exercises" })).toHaveAttribute("href", "/exercises")
    fireEvent.click(screen.getByRole("button", { name: "admin.nav.analytics" }))
    expect(screen.getByRole("link", { name: "admin.nav.analyticsUsers" })).toHaveAttribute("href", "/analytics/users")
    expect(screen.getByRole("link", { name: "admin.nav.analyticsNotifications" })).toHaveAttribute("href", "/analytics/notifications")
    expect(screen.queryByRole("link", { name: "admin.nav.settings" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "admin.nav.events" })).toHaveAttribute("aria-current", "page")
  })

  it("keeps icon-only navigation accessible and expands a grouped section", () => {
    const onToggleCollapse = vi.fn()
    render(<Sidebar collapsed onToggleCollapse={onToggleCollapse} />)
    expect(screen.getByRole("link", { name: "admin.nav.events" })).toHaveAttribute("title", "admin.nav.events")
    expect(screen.getByRole("button", { name: "Розгорнути панель" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.nav.notifications" }))
    expect(onToggleCollapse).toHaveBeenCalledOnce()
  })

  it("does not show the platform infrastructure section without its permission", () => {
    rights.infrastructure = false
    render(<Sidebar />)
    expect(screen.queryByRole("link", { name: "admin.nav.labs" })).not.toBeInTheDocument()
    expect(screen.queryByText("admin.nav.section.platform")).not.toBeInTheDocument()
  })
})
