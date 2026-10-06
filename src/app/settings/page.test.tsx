import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import Page from "./page"

const apiGet = vi.fn()
const apiPut = vi.fn()
vi.mock("@/api/client", () => ({ apiGet: (...args: unknown[]) => apiGet(...args), apiPut: (...args: unknown[]) => apiPut(...args) }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

describe("platform settings page", () => {
  it("loads settings and saves a validated value", async () => {
    apiGet.mockResolvedValue([{ ID: "id-1", Key: "site.title", Value: "Old title", RequiredPermission: "", CreatedAt: "2026-01-01", UpdatedAt: "2026-01-01" }])
    apiPut.mockResolvedValue({ ID: "id-1", Key: "site.title", Value: "New title", RequiredPermission: "" })
    render(<Page />)
    expect(await screen.findByText("site.title")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Редагувати site.title" }))
    fireEvent.change(screen.getByLabelText("Значення"), { target: { value: 'New title' } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith("/api/settings/site.title", { Value: "New title", RequiredPermission: "" }))
    expect(await screen.findByText("New title")).toBeInTheDocument()
  })
  it("renders one h1 and toggles a boolean at once, rolling back on error", async () => {
    apiGet.mockResolvedValue([{ ID: "id-2", Key: "flag.on", Value: false, RequiredPermission: "", CreatedAt: "2026-01-01", UpdatedAt: "2026-01-01" }])
    let fail!: (e: Error) => void
    apiPut.mockReturnValue(new Promise((_, reject) => { fail = reject }))
    render(<Page />)
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument()
    const sw = await screen.findByRole("switch", { name: "flag.on" })
    fireEvent.click(sw)
    expect(sw).toHaveAttribute("aria-checked", "true")
    expect(sw).not.toBeDisabled()
    fail(new Error("x"))
    await waitFor(() => expect(sw).toHaveAttribute("aria-checked", "false"))
  })
  it("explains an empty list instead of a bare notice, pointing to the mail tab", async () => {
    apiGet.mockResolvedValue([])
    render(<Page />)
    expect(await screen.findByText(/Окремих параметрів платформи поки немає/)).toHaveTextContent("«Пошта»")
    expect(screen.getByRole("link", { name: "Пошта" })).toHaveAttribute("href", "/settings/mail")
  })
})
