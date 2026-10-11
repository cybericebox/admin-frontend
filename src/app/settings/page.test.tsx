import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import Page from "./page"

const apiGet = vi.fn()
const apiPut = vi.fn()
vi.mock("@/api/client", () => ({ apiGet: (...args: unknown[]) => apiGet(...args), apiPut: (...args: unknown[]) => apiPut(...args) }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

describe("platform settings page", () => {
  it.each([[1, "1.0"], [{ a: 1, b: 2 }, '{"b":2,"a":1}']])("disables visible Save and does not submit an equivalent saved value %j", async (value, equivalent) => {
    apiPut.mockClear()
    apiGet.mockResolvedValue([{ ID: "id", Key: "value", Value: value, RequiredPermission: "", CreatedAt: "", UpdatedAt: "" }])
    render(<Page />)
    fireEvent.click(await screen.findByRole("button", { name: "Редагувати value" }))
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled()
    const input = screen.getByLabelText("Значення")
    fireEvent.change(input, { target: { value: equivalent } })
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled()
    fireEvent.submit(input.closest("form")!)
    expect(apiPut).not.toHaveBeenCalled()
  })

  it("keeps newer setting edits while an earlier value is being saved", async () => {
    apiGet.mockResolvedValue([{ ID: "id", Key: "value", Value: "Saved", RequiredPermission: "", CreatedAt: "", UpdatedAt: "" }])
    let resolve!: (value: unknown) => void
    apiPut.mockReturnValue(new Promise((done) => { resolve = done }))
    render(<Page />)
    fireEvent.click(await screen.findByRole("button", { name: "Редагувати value" }))
    const input = screen.getByLabelText("Значення")
    fireEvent.change(input, { target: { value: "First" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    fireEvent.change(input, { target: { value: "Newer" } })
    resolve({ ID: "id", Key: "value", Value: "First", RequiredPermission: "", CreatedAt: "", UpdatedAt: "" })
    await waitFor(() => expect(screen.getByLabelText("Значення")).toHaveValue("Newer"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Зберегти" })).toBeEnabled())
  })

  it("does not busy another setting editor while the previous setting saves", async () => {
    apiGet.mockResolvedValue(["first", "second"].map((key) => ({ ID: key, Key: key, Value: "Saved", RequiredPermission: "", CreatedAt: "", UpdatedAt: "" })))
    let resolve!: (value: unknown) => void
    apiPut.mockReturnValue(new Promise((done) => { resolve = done }))
    render(<Page />)
    fireEvent.click(await screen.findByRole("button", { name: "Редагувати first" }))
    fireEvent.change(screen.getByLabelText("Значення"), { target: { value: "First changed" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    fireEvent.click(screen.getByRole("button", { name: "Скасувати" }))
    fireEvent.click(screen.getByRole("button", { name: "Редагувати second" }))
    fireEvent.change(screen.getByLabelText("Значення"), { target: { value: "Second changed" } })
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeEnabled()
    resolve({ ID: "first", Key: "first", Value: "First changed", RequiredPermission: "", CreatedAt: "", UpdatedAt: "" })
    await waitFor(() => expect(screen.getByLabelText("Значення")).toHaveValue("Second changed"))
  })
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
