import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { AdminShell } from "./AdminShell"
import { usePageMeta } from "./PageTitle"

const path = vi.hoisted(() => ({ value: "/dashboard" }))
vi.mock("next/navigation", () => ({ usePathname: () => path.value }))
const role = vi.hoisted(() => ({ value: { role: "admin" as string | null, isLoading: false, me: null as { Email: string } | null, can: (): boolean => true } }))
vi.mock("@/lib/useRole", () => ({ useRole: () => role.value }))
vi.mock("@/lib/origins", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/origins")>()), idOrigin: "https://id.example.test", mainOrigin: "https://example.test" }))
vi.mock("@/api/client", () => ({ apiPost: vi.fn() }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/components/brand/Logo", () => ({ Logo: () => <span>crest</span>, CREST_SRC: "/crest.png" }))
vi.mock("./TopBar", () => ({ TopBar: ({ crumbs, onMenuClick }: { crumbs: { label: string }[]; onMenuClick: () => void }) => <><button onClick={onMenuClick}>menu</button><p data-testid="bar-title">{crumbs.map((crumb) => crumb.label).join(" > ")}</p></> }))
vi.mock("./Sidebar", () => ({ Sidebar: ({ onClose }: { onClose?: () => void }) => <aside aria-label="sidebar">{onClose && <button onClick={onClose}>admin.shell.closeMenu</button>}</aside> }))
vi.mock("./SiteBanner", () => ({ SiteBannerBar: () => null }))

const replace = vi.fn()
const original = window.location
const media = { matches: true }

describe("admin shell", () => {
  beforeEach(() => {
    role.value = { role: "admin", isLoading: false, me: null, can: () => true }
    replace.mockReset()
    path.value = "/dashboard"
    media.matches = true
    window.matchMedia = ((query: string) => ({ matches: media.matches, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
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

  it("mounts one sidebar per breakpoint: the desktop sidebar wide, a modal drawer narrow", () => {
    const { unmount } = render(<AdminShell><span>content</span></AdminShell>)
    expect(screen.getAllByRole("complementary", { name: "sidebar" })).toHaveLength(1)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    unmount()

    media.matches = false
    render(<AdminShell><span>content</span></AdminShell>)
    expect(screen.queryByRole("complementary", { name: "sidebar" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "menu" }))
    expect(screen.getByRole("dialog", { name: "admin.shell.navLabel" })).toBeInTheDocument()
    expect(screen.getAllByRole("complementary", { name: "sidebar" })).toHaveLength(1)
  })

  it("the drawer closes on Esc and on its close button", () => {
    media.matches = false
    render(<AdminShell><span>content</span></AdminShell>)
    fireEvent.click(screen.getByRole("button", { name: "menu" }))
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "menu" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.shell.closeMenu" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("titles the top bar and the document by route, never «Головна» for other sections", () => {
    path.value = "/resources/"
    render(<AdminShell><span>content</span></AdminShell>)
    expect(screen.getByTestId("bar-title")).toHaveTextContent("admin.nav.resources")
    expect(document.title).toBe("admin.title.template")
  })

  it("shows the crumbs a page reports instead of the bare section, and no h1 of its own", () => {
    function Page() {
      usePageMeta("Новий захід", [{ label: "Заходи", href: "/events" }, { label: "Новий захід" }])
      return <span>content</span>
    }
    path.value = "/events/new/"
    render(<AdminShell><Page /></AdminShell>)
    expect(screen.getByTestId("bar-title")).toHaveTextContent("Заходи > Новий захід")
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  it("uses the section-less title on an unknown route", () => {
    path.value = "/somewhere-new/"
    render(<AdminShell><span>content</span></AdminShell>)
    expect(screen.getByTestId("bar-title")).toHaveTextContent("admin.shell.title")
    expect(document.title).toBe("meta.title")
  })

  it("has no compact sidebar mode", () => {
    render(<AdminShell><span>content</span></AdminShell>)
    expect(screen.queryByRole("button", { name: "admin.shell.collapsePanel" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "admin.shell.expandPanel" })).not.toBeInTheDocument()
  })
})
