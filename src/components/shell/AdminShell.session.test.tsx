import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { AdminShell } from "./AdminShell"
import { useRole } from "@/lib/useRole"
import { ApiError } from "@/api/client"

vi.mock("@/lib/useRole", () => ({ useRole: vi.fn() }))
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }))
vi.mock("./SignInRedirect", () => ({ SignInRedirect: () => <div>redirecting-to-sign-in</div> }))
vi.mock("./Sidebar", () => ({ Sidebar: () => null }))
vi.mock("./TopBar", () => ({ TopBar: () => null }))
vi.mock("./SiteBanner", () => ({ SiteBannerBar: () => null }))
vi.mock("./MobileDrawer", () => ({ MobileDrawer: () => null }))

const base = { me: null, permissions: [], can: () => false, retry: vi.fn() }

describe("AdminShell session gate", () => {
  it("shows the 500 page with a retry when the session check fails", () => {
    const retry = vi.fn()
    vi.mocked(useRole).mockReturnValue({ ...base, role: null, isLoading: false, error: new Error("API 500"), retry })
    render(<AdminShell>x</AdminShell>)
    expect(screen.getByText("500")).toBeInTheDocument()
    screen.getAllByRole("button")[0].click()
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.queryByText("redirecting-to-sign-in")).not.toBeInTheDocument()
  })

  it("shows the reference number of a 5xx answer", () => {
    const err = new ApiError(500, null, "boom", undefined, undefined, undefined, "0a1b2c3d-0000-0000-0000-000000000000")
    vi.mocked(useRole).mockReturnValue({ ...base, role: null, isLoading: false, error: err })
    render(<AdminShell>x</AdminShell>)
    expect(screen.getByText(/0a1b2c3d/)).toBeInTheDocument()
  })

  it("redirects to sign-in on 401 (no error, no session)", () => {
    vi.mocked(useRole).mockReturnValue({ ...base, role: null, isLoading: false, error: null })
    render(<AdminShell>x</AdminShell>)
    expect(screen.getByText("redirecting-to-sign-in")).toBeInTheDocument()
  })
})
