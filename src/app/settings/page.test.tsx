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
    fireEvent.change(screen.getByLabelText("Значення"), { target: { value: '"New title"' } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith("/api/settings/site.title", { Value: "New title", RequiredPermission: "" }))
    expect(await screen.findByText("New title")).toBeInTheDocument()
  })
})
