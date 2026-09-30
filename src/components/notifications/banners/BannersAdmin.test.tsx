import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { BannersAdmin } from "./BannersAdmin"

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }))
vi.mock("@/api/notifications/banners", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/notifications/banners")>()),
  listBanners: api.list, createBanner: api.create, updateBanner: api.update, deleteBanner: api.remove,
}))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

const banner = { ID: "b1", Text: "Планові роботи", LinkURL: "", LinkLabel: "", Level: "warning", ActiveFrom: null, ActiveTo: null, Dismissible: true, Audience: "everyone", IsActive: true }

describe("banners admin page", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset())
    api.list.mockResolvedValue([banner])
    api.create.mockResolvedValue(banner)
    api.update.mockResolvedValue(banner)
    api.remove.mockResolvedValue(undefined)
  })

  it("shows the empty state", async () => {
    api.list.mockResolvedValue([])
    render(<BannersAdmin />)
    expect(await screen.findByText("Банерів ще немає")).toBeInTheDocument()
  })

  it("shows a load error with retry", async () => {
    api.list.mockRejectedValueOnce(new Error("down"))
    render(<BannersAdmin />)
    fireEvent.click(await screen.findByRole("button", { name: "Спробувати ще раз" }))
    expect(await screen.findByText("Планові роботи")).toBeInTheDocument()
  })

  it("creates a banner with a live preview", async () => {
    render(<BannersAdmin />)
    await screen.findByText("Планові роботи")
    fireEvent.click(screen.getByRole("button", { name: "Створити банер" }))
    fireEvent.change(await screen.findByLabelText("Текст"), { target: { value: "Нова версія" } })
    expect(screen.getByTestId("banner-preview")).toHaveTextContent("Нова версія")
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ Text: "Нова версія", Level: "info", Audience: "everyone", Dismissible: true, IsActive: true, ActiveFrom: null, ActiveTo: null })))
  })

  it("blocks saving an empty text or a bad link", async () => {
    render(<BannersAdmin />)
    await screen.findByText("Планові роботи")
    fireEvent.click(screen.getByRole("button", { name: "Створити банер" }))
    const save = await screen.findByRole("button", { name: "Зберегти" })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Текст"), { target: { value: "Текст" } })
    fireEvent.change(screen.getByLabelText("Посилання"), { target: { value: "javascript:1" } })
    expect(save).toBeDisabled()
  })

  it("deactivates a banner", async () => {
    render(<BannersAdmin />)
    await screen.findByText("Планові роботи")
    fireEvent.click(screen.getByRole("button", { name: "Вимкнути" }))
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("b1", expect.objectContaining({ IsActive: false, Text: "Планові роботи" })))
  })

  it("deletes only after the danger confirmation", async () => {
    render(<BannersAdmin />)
    await screen.findByText("Планові роботи")
    fireEvent.click(screen.getByRole("button", { name: "Видалити" }))
    expect(api.remove).not.toHaveBeenCalled()
    expect(await screen.findByText("Видалити банер?")).toBeInTheDocument()
    const buttons = screen.getAllByRole("button", { name: "Видалити" })
    fireEvent.click(buttons[buttons.length - 1])
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("b1"))
  })
})
