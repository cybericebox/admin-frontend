import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { NoAccessScreen } from "./NoAccessScreen"

vi.mock("@/lib/useRole", () => ({ useRole: () => ({ me: { Email: "a@example.test" } }) }))
vi.mock("@/api/client", () => ({ apiPost: vi.fn().mockResolvedValue({}) }))
vi.mock("@/lib/signInRedirect", () => ({ signInRedirectTarget: () => "" }))
vi.mock("./SignInRedirect", () => ({ SignInRedirect: () => null }))

const replace = vi.fn()
beforeEach(() => {
  replace.mockClear()
  vi.stubGlobal("location", { ...window.location, href: "http://localhost/", replace })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  document.documentElement.removeAttribute("data-cfg-main-site-url")
})

describe("NoAccessScreen", () => {
  it("the home button is a main-site link that the stylesheet hides when there is no main site", () => {
    vi.stubEnv("NEXT_PUBLIC_MAIN_SITE_URL", "https://example.org")
    render(<NoAccessScreen />)
    const home = screen.getByRole("link", { name: "На головну" })
    expect(home).toHaveAttribute("href", "https://example.org")
    expect(home).toHaveClass("cfg-main-only")
    // beside the button the home link is the only way out: never a link to this very screen
    expect(home.parentElement?.querySelectorAll("a")).toHaveLength(1)
    expect(home.parentElement?.querySelectorAll("button")).toHaveLength(1)
  })

  it.each([
    ["no main site", "", "/"],
    ["a main site", "https://example.org", "https://example.org"],
  ])("switching the account without a sign-in target goes to the main site, else to / (%s)", async (_, attr, expected) => {
    if (attr) document.documentElement.setAttribute("data-cfg-main-site-url", attr)
    render(<NoAccessScreen />)
    fireEvent.click(screen.getByRole("button", { name: "Увійти іншим обліковим записом" }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith(expected))
  })
})
