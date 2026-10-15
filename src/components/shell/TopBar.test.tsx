import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { TopBar } from "./TopBar"

const role = vi.hoisted(() => ({ value: "admin_viewer" as string }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ role: role.value, me: { FirstName: "Іра", LastName: "К", Email: "i@k.test", Picture: "" }, can: () => true }) }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("@/api/client", () => ({ apiPost: vi.fn(), mediaUrl: (value: string) => value }))
vi.mock("@/lib/origins", () => ({ idOrigin: "https://id.test", exercisesOrigin: "https://ex.test" }))
vi.mock("./InboxButton", () => ({ InboxButton: () => <button>inbox</button> }))
vi.mock("@/components/consent/CookieSettingsMenuItem", () => ({ CookieSettingsMenuItem: () => <div role="menuitem">cookies</div> }))
vi.mock("@/components/FeedbackMenuItem", () => ({ FeedbackMenuItem: () => <div role="menuitem">feedback</div> }))

describe("top bar", () => {
  beforeEach(() => {
    document.cookie = "cib_theme=; path=/; domain=.localhost; max-age=0"
    document.documentElement.dataset.theme = "light"
  })

  it("keeps Profile first and leaves the catalog link in the left navigation", () => {
    role.value = "admin"
    render(<TopBar crumbs={[]} />)
    fireEvent.keyDown(screen.getByRole("button", { name: "admin.accountMenu" }), { key: "ArrowDown" })
    expect(screen.queryByRole("menuitem", { name: "accountMenu.exercises" })).not.toBeInTheDocument()
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "accountMenu.profile", "theme.labeltheme.system", "feedback", "cookies", "accountMenu.signOut",
    ])
  })

  it("keeps theme choices behind one expandable account row on every screen and preserves view-only badges", async () => {
    role.value = "admin_viewer"
    const { container } = render(<TopBar crumbs={[{ label: "Заходи" }]} />)
    expect(screen.queryByRole("radiogroup", { name: "theme.label" })).not.toBeInTheDocument()
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
    expect(container.querySelector("header span.max-md\\:hidden")).toHaveTextContent("admin.role.viewOnlyBadge")
    fireEvent.keyDown(screen.getByRole("button", { name: "admin.accountMenu" }), { key: "ArrowDown" })
    const theme = screen.getByRole("menuitem", { name: /theme.label/ })
    expect(theme).toHaveTextContent("theme.system")
    expect(theme).toHaveAttribute("aria-expanded", "false")
    expect(theme.closest(".md\\:hidden")).toBeNull()
    expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument()
    expect(screen.getAllByText("admin.role.viewOnlyBadge")).toHaveLength(2)
    fireEvent.click(theme)
    const light = await screen.findByRole("menuitemradio", { name: "theme.light" })
    expect(theme).toHaveAttribute("aria-expanded", "true")
    expect(light.closest('[role="menu"]')).toBe(theme.closest('[role="menu"]'))
    expect(screen.getByRole("menuitemradio", { name: "theme.system" })).toHaveAttribute("aria-checked", "true")
    fireEvent.click(screen.getByRole("menuitemradio", { name: "theme.dark" }))
    expect(document.documentElement.dataset.theme).toBe("dark")
    fireEvent.keyDown(screen.getByRole("button", { name: "admin.accountMenu" }), { key: "ArrowDown" })
    expect(screen.getByRole("menuitem", { name: /theme.label/ })).toHaveTextContent("theme.dark")
    expect(screen.getByRole("menuitem", { name: /theme.label/ })).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument()
  })

  it("expands inline theme choices with Enter and closes them with ArrowLeft", async () => {
    role.value = "admin"
    render(<TopBar crumbs={[]} />)
    fireEvent.keyDown(screen.getByRole("button", { name: "admin.accountMenu" }), { key: "ArrowDown" })
    const theme = screen.getByRole("menuitem", { name: /theme.label/ })
    theme.focus()
    fireEvent.keyDown(theme, { key: "Enter" })
    const light = await screen.findByRole("menuitemradio", { name: "theme.light" })
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(3)
    light.focus()
    fireEvent.keyDown(light, { key: "ArrowLeft" })
    await waitFor(() => expect(theme).toHaveFocus())
    expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument()
    fireEvent.keyDown(theme, { key: "Escape" })
    await waitFor(() => expect(screen.getByRole("button", { name: "admin.accountMenu" })).toHaveFocus())
  })

  it("keeps only the section link in the top bar, without duplicating the page heading", () => {
    role.value = "admin"
    render(<TopBar crumbs={[{ label: "Заходи", href: "/events" }, { label: "Новий захід" }]} />)
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Заходи" })).toHaveAttribute("href", "/events")
    expect(screen.queryByText("Новий захід")).not.toBeInTheDocument()
  })

  it("keeps a deep object's name and leaf title out of the top bar", () => {
    render(<TopBar crumbs={[{ label: "Помилки", href: "/errors" }, { label: "Назва обʼєкта", href: "/errors/object" }, { label: "Контрольна перевірка доставки CIB-NOTIFY-20261015-e8605811" }]} />)
    expect(screen.getByRole("link", { name: "Помилки" })).toHaveAttribute("href", "/errors")
    expect(screen.queryByText("Назва обʼєкта")).not.toBeInTheDocument()
    expect(screen.queryByText(/CIB-NOTIFY/)).not.toBeInTheDocument()
  })

  it("a top-level page shows its section as plain text, not a link to itself", () => {
    role.value = "admin"
    render(<TopBar crumbs={[{ label: "Головна" }]} />)
    expect(screen.getByText("Головна")).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("link", { name: "Головна" })).not.toBeInTheDocument()
  })
})
