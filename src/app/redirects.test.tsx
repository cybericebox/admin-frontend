import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("./dashboard/page", () => ({ default: () => <div>dashboard page</div> }))
vi.mock("./notifications/logs/page", () => ({ default: () => <div>logs page</div> }))
import Root from "./page"
import Notifications from "./notifications/page"

describe("the entry routes draw their page at once", () => {
  it("«/» is the dashboard, and the address then names it", () => {
    window.history.replaceState(null, "", "/")
    render(<Root />)
    expect(screen.getByText("dashboard page")).toBeInTheDocument()
    expect(window.location.pathname).toBe("/dashboard/")
  })
  it("«/notifications» is the delivery log, and the address then names it", () => {
    window.history.replaceState(null, "", "/notifications")
    render(<Notifications />)
    expect(screen.getByText("logs page")).toBeInTheDocument()
    expect(window.location.pathname).toBe("/notifications/logs/")
  })
})
