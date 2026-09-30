import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { AdminShell } from "./AdminShell"

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ role: "admin", isLoading: false, can: () => true }) }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/components/brand/Logo", () => ({ Logo: () => <span>crest</span> }))
vi.mock("./TopBar", () => ({ TopBar: ({ onMenuClick }: { onMenuClick: () => void }) => <button onClick={onMenuClick}>menu</button> }))
vi.mock("./SiteBanner", () => ({ SiteBannerBar: () => null }))

describe("admin shell", () => {
  it("opens and closes the navigation drawer", () => {
    render(<AdminShell><span>content</span></AdminShell>)
    expect(screen.getByText("content")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "menu" }))
    expect(screen.getByRole("button", { name: "admin.shell.closeMenu" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.shell.closeMenu" }))
    expect(screen.queryByRole("button", { name: "admin.shell.closeMenu" })).not.toBeInTheDocument()
  })

  it("persists the compact sidebar preference", async () => {
    const storage = new Map<string, string>()
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } })
    render(<AdminShell><span>content</span></AdminShell>)
    fireEvent.click(screen.getByRole("button", { name: "admin.shell.collapsePanel" }))
    expect(screen.getByRole("button", { name: "admin.shell.expandPanel" })).toBeInTheDocument()
    expect(storage.get("cybericebox.admin.sidebar.collapsed")).toBe("true")
  })

  it("restores the compact sidebar preference", async () => {
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: () => "true",
      setItem: vi.fn(),
    } })
    render(<AdminShell><span>content</span></AdminShell>)
    expect(await screen.findByRole("button", { name: "admin.shell.expandPanel" })).toBeInTheDocument()
  })
})
