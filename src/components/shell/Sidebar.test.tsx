import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { Sidebar } from "./Sidebar"

const nav = vi.hoisted(() => ({ path: "/events" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }))
const rights = vi.hoisted(() => ({ infrastructure: true, denied: new Set<string>() }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (permission: string) => permission !== "platform.settings.read" && !rights.denied.has(permission) && (permission !== "infrastructure.read" || rights.infrastructure) }) }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/components/brand/Logo", () => ({ Logo: () => <span>crest</span> }))
vi.mock("@/lib/origins", () => ({ exercisesOrigin: "https://exercises.cybericebox.local", publicDomain: "example.org" }))

describe("admin sidebar", () => {
  beforeEach(() => { rights.infrastructure = true; rights.denied = new Set(); nav.path = "/events" })
  it("links to available administration sections and respects permissions", () => {
    render(<Sidebar />)
    expect(screen.getByRole("link", { name: "admin.nav.events" })).toHaveAttribute("href", "/events")
    fireEvent.click(screen.getByRole("button", { name: "admin.nav.section.platform" }))
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

  it("has no collapse control", () => {
    render(<Sidebar />)
    expect(screen.queryByRole("button", { name: "admin.shell.collapsePanel" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "admin.shell.expandPanel" })).not.toBeInTheDocument()
  })

  it("uses the event sidebar structure: one row style, an icon on every row and sub-item, no section headings", () => {
    const { container } = render(<Sidebar />)
    expect(screen.queryByText("admin.nav.section.content")).not.toBeInTheDocument()
    const nav = container.querySelector("nav")!
    const rows = Array.from(nav.querySelectorAll<HTMLElement>(":scope > a, :scope > section > button"))
    // Overview, Events, Catalog, Users + the groups Analytics / Notifications / Platform.
    expect(rows.map((row) => row.textContent)).toEqual(["admin.nav.dashboard", "admin.nav.events", "admin.nav.exercises", "admin.nav.users", "admin.nav.analytics", "admin.nav.notifications", "admin.nav.section.platform"])
    for (const row of rows) {
      expect(row).toHaveClass("ib-admin-side__item")
      expect(row.querySelector("svg")).toBeTruthy()
    }
    for (const heading of nav.querySelectorAll("button[aria-expanded]")) fireEvent.click(heading)
    const subItems = nav.querySelectorAll("section a")
    expect(subItems.length).toBeGreaterThan(10)
    for (const link of subItems) expect(link.querySelector("svg"), link.textContent ?? "").toBeTruthy()
  })

  it("indents nothing: sub-items sit in the same column as the group header", () => {
    const { container } = render(<Sidebar />)
    fireEvent.click(screen.getByRole("button", { name: "admin.nav.analytics" }))
    const items = container.querySelector("#admin-group-analytics")!
    expect(items.className).toBe("event-manage-sidebar__items")
    expect(items.className).not.toMatch(/\b(ml-|pl-|border-l)/)
    expect(items.querySelector("a")!.className).toBe("ib-admin-side__item")
  })

  it("groups collapse and expand, and the group of the current page starts open", () => {
    nav.path = "/notifications/logs"
    render(<Sidebar />)
    const group = screen.getByRole("button", { name: "admin.nav.notifications" })
    expect(group).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(group)
    expect(group).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("link", { name: "admin.nav.notif.logs" })).not.toBeInTheDocument()
  })

  it("Platform is a normal collapsible group", () => {
    rights.denied = new Set()
    const original = rights.infrastructure
    rights.infrastructure = true
    render(<Sidebar />)
    fireEvent.click(screen.getByRole("button", { name: "admin.nav.section.platform" }))
    expect(screen.getByRole("link", { name: "admin.nav.labs" })).toHaveAttribute("href", "/labs")
    rights.infrastructure = original
  })

  describe("return to the event", () => {
    const from = (url: string, name = "CTF 2027") => window.history.replaceState(null, "", `/dashboard?from=${encodeURIComponent(url)}&from_name=${encodeURIComponent(name)}`)
    beforeEach(() => { window.sessionStorage.clear(); window.history.replaceState(null, "", "/dashboard") })

    it("is hidden without an origin", () => {
      render(<Sidebar />)
      expect(screen.queryByRole("link", { name: /admin.nav.returnToEvent/ })).not.toBeInTheDocument()
    })

    it("names the event and links back when the origin is our event's /manage", async () => {
      from("https://ctf.example.org/manage/labs")
      render(<Sidebar />)
      const back = await screen.findByRole("link", { name: /admin.nav.returnToEvent/ })
      expect(back).toHaveAttribute("href", "https://ctf.example.org/manage/labs")
      // The origin outlives the address: it is kept for the session.
      window.history.replaceState(null, "", "/events")
      cleanup()
      render(<Sidebar />)
      expect(await screen.findByRole("link", { name: /admin.nav.returnToEvent/ })).toHaveAttribute("href", "https://ctf.example.org/manage/labs")
    })

    it("ignores a foreign host, another app of ours and a non-/manage page", () => {
      for (const url of ["https://evil.com/manage", "https://ctf.example.org.evil.com/manage", "https://exercises.example.org/manage", "https://id.example.org/manage", "https://ctf.example.org/participation", "http://ctf.example.org/manage"]) {
        cleanup()
        window.sessionStorage.clear()
        from(url)
        render(<Sidebar />)
        expect(screen.queryByRole("link", { name: /admin.nav.returnToEvent/ }), url).not.toBeInTheDocument()
      }
    })
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

  it("orders the notifications group in three blocks split by dividers", () => {
    nav.path = "/notifications/logs"
    const { container } = render(<Sidebar />)
    const group = container.querySelector("#admin-group-notifications")!
    const order = Array.from(group.children).map((n) => (n.tagName === "HR" ? "|" : n.textContent))
    expect(order).toEqual(["admin.nav.notif.broadcasts", "admin.nav.notif.banners", "|", "admin.nav.notif.tplInApp", "admin.nav.notif.tplEmail", "admin.nav.notif.settings", "|", "admin.nav.notif.logs"])
  })
})
