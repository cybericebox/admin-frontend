import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { Sidebar } from "./Sidebar"

const nav = vi.hoisted(() => ({ path: "/events" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }))
const rights = vi.hoisted(() => ({ infrastructure: true, denied: new Set<string>() }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (permission: string) => permission !== "platform.settings.read" && !rights.denied.has(permission) && (permission !== "infrastructure.read" || rights.infrastructure) }) }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/components/brand/Logo", () => ({ Logo: () => <span>crest</span> }))
vi.mock("@/lib/origins", () => ({ exercisesOrigin: "https://exercises.cybericebox.local" }))

describe("admin sidebar", () => {
  beforeEach(() => { rights.infrastructure = true; rights.denied = new Set(); nav.path = "/events" })
  it("links to available administration sections and respects permissions", () => {
    render(<Sidebar />)
    expect(screen.getByRole("link", { name: "admin.nav.events" })).toHaveAttribute("href", "/events")
    expect(screen.getByRole("link", { name: "admin.nav.labs" })).toHaveAttribute("href", "/labs")
    const exercises = screen.getByRole("link", { name: "admin.nav.exercises" })
    // The catalog opens with return_to, so it can offer the way back here.
    expect(exercises).toHaveAttribute("href", `https://exercises.cybericebox.local?return_to=${encodeURIComponent(window.location.href)}`)
    expect(exercises).not.toHaveAttribute("aria-current")
    fireEvent.click(screen.getByRole("button", { name: "admin.nav.analytics" }))
    const analytics = ["Overview:/analytics", "Users:/analytics/users", "Events:/analytics/events", "Tasks:/analytics/tasks", "Infrastructure:/analytics/infrastructure", "Mail:/analytics/mail", "Notifications:/analytics/notifications"]
    for (const entry of analytics) {
      const [name, href] = entry.split(":")
      expect(screen.getByRole("link", { name: `admin.nav.analytics${name}` })).toHaveAttribute("href", href)
    }
    expect(screen.queryByRole("link", { name: "admin.nav.settings" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "admin.nav.events" })).toHaveAttribute("aria-current", "page")
  })

  it("keeps icon-only navigation accessible and expands a grouped section", () => {
    const onToggleCollapse = vi.fn()
    render(<Sidebar collapsed onToggleCollapse={onToggleCollapse} />)
    expect(screen.getByRole("link", { name: "admin.nav.events" })).not.toHaveAttribute("title")
    expect(screen.getByRole("link", { name: "admin.nav.exercises" })).not.toHaveAttribute("title")
    expect(screen.getByRole("button", { name: "admin.shell.expandPanel" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.nav.notifications" }))
    expect(onToggleCollapse).toHaveBeenCalledOnce()
  })

  it("names collapsed items in a tooltip to the right, on hover and on keyboard focus", () => {
    render(<Sidebar collapsed onToggleCollapse={() => {}} />)
    const events = screen.getByRole("link", { name: "admin.nav.events" })
    fireEvent.focus(events)
    const tip = screen.getByRole("tooltip")
    expect(tip).toHaveTextContent("admin.nav.events")
    expect(tip.style.transform).toBe("translateY(-50%)")
    fireEvent.blur(events)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    fireEvent.pointerEnter(screen.getByRole("button", { name: "admin.nav.notifications" }))
    expect(screen.getByRole("tooltip")).toHaveTextContent("admin.nav.notifications")
  })

  it("shows no tooltips when expanded", () => {
    render(<Sidebar onToggleCollapse={() => {}} />)
    fireEvent.focus(screen.getByRole("link", { name: "admin.nav.events" }))
    fireEvent.pointerEnter(screen.getByRole("link", { name: "admin.nav.labs" }))
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("does not show the platform infrastructure section without its permission", () => {
    rights.infrastructure = false
    render(<Sidebar />)
    expect(screen.queryByRole("link", { name: "admin.nav.labs" })).not.toBeInTheDocument()
    expect(screen.queryByText("admin.nav.section.platform")).not.toBeInTheDocument()
  })

  it("keeps Users in analytics for the old users.read right and hides the rest without analytics.read", () => {
    rights.denied = new Set(["analytics.read", "notifications.templates.read"])
    nav.path = "/analytics/users"
    render(<Sidebar />)
    expect(screen.getByRole("link", { name: "admin.nav.analyticsUsers" })).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("link", { name: "admin.nav.analyticsOverview" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "admin.nav.analyticsMail" })).not.toBeInTheDocument()
  })

  it("marks Overview current only on /analytics itself", () => {
    nav.path = "/analytics/events"
    render(<Sidebar />)
    expect(screen.getByRole("link", { name: "admin.nav.analyticsOverview" })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("link", { name: "admin.nav.analyticsEvents" })).toHaveAttribute("aria-current", "page")
  })
})
