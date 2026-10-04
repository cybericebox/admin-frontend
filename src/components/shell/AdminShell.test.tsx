import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { AdminShell } from "./AdminShell"

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }))
const role = vi.hoisted(() => ({ value: { role: "admin" as string | null, isLoading: false, me: null as { Email: string } | null, can: (): boolean => true } }))
vi.mock("@/lib/useRole", () => ({ useRole: () => role.value }))
vi.mock("@/lib/origins", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/origins")>()), idOrigin: "https://id.example.test", mainOrigin: "https://example.test" }))
vi.mock("@/api/client", () => ({ apiPost: vi.fn() }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/components/brand/Logo", () => ({ Logo: () => <span>crest</span>, CREST_SRC: "/crest.png" }))
vi.mock("./TopBar", () => ({ TopBar: ({ onMenuClick }: { onMenuClick: () => void }) => <button onClick={onMenuClick}>menu</button> }))
vi.mock("./SiteBanner", () => ({ SiteBannerBar: () => null }))

const replace = vi.fn()
const original = window.location

describe("admin shell", () => {
  beforeEach(() => {
    role.value = { role: "admin", isLoading: false, me: null, can: () => true }
    replace.mockReset()
    Object.defineProperty(window, "location", { configurable: true, value: { href: "https://admin.example.test/users?x=1", replace } })
  })
  afterEach(() => Object.defineProperty(window, "location", { configurable: true, value: original }))

  it("redirects a visitor without a session to the sign-in with the current page as return_to, no card or button", () => {
    role.value = { role: null, isLoading: false, me: null, can: () => false }
    render(<AdminShell><span>content</span></AdminShell>)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith(`https://id.example.test/sign-in?return_to=${encodeURIComponent("https://admin.example.test/users?x=1")}`)
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("does not redirect when already on the sign-in page", () => {
    Object.defineProperty(window, "location", { configurable: true, value: { href: "https://id.example.test/sign-in", replace } })
    role.value = { role: null, isLoading: false, me: null, can: () => false }
    render(<AdminShell><span>content</span></AdminShell>)
    expect(replace).not.toHaveBeenCalled()
  })

  it("shows the no-access screen with the account email for a signed-in user without rights", () => {
    role.value = { role: "user", isLoading: false, me: { Email: "a@b.test" }, can: () => false }
    render(<AdminShell><span>content</span></AdminShell>)
    expect(screen.getByText("auth.noAccess.body")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "auth.noAccess.switch" })).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it("opens and closes the navigation drawer", () => {
    render(<AdminShell><span>content</span></AdminShell>)
    expect(screen.getByText("content")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "menu" }))
    expect(screen.getByRole("button", { name: "admin.shell.closeMenu" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.shell.closeMenu" }))
    expect(screen.queryByRole("button", { name: "admin.shell.closeMenu" })).not.toBeInTheDocument()
  })

  it("has no compact sidebar mode", () => {
    render(<AdminShell><span>content</span></AdminShell>)
    expect(screen.queryByRole("button", { name: "admin.shell.collapsePanel" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "admin.shell.expandPanel" })).not.toBeInTheDocument()
  })
})
