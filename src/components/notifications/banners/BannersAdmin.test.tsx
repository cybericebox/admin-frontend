import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ApiError } from "@/api/client"
import { BannersAdmin, bannerState } from "./BannersAdmin"

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), events: vi.fn(), event: vi.fn() }))
vi.mock("@/api/events/catalog", () => ({ listEventsPage: api.events, getEvent: api.event }))
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
    api.events.mockResolvedValue({ Items: [], Total: 0 })
    api.event.mockImplementation((id: string) => Promise.resolve({ ID: id, Name: id === "event-1" ? "Зимовий CTF" : "Осінній CTF" }))
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

  it("enables visible Save only for a changed banner and keeps newer text after an earlier save", async () => {
    let resolve!: (value: unknown) => void
    api.update.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    render(<BannersAdmin />)
    await screen.findByText("Планові роботи")
    fireEvent.click(screen.getByRole("button", { name: "Редагувати" }))
    const input = await screen.findByLabelText("Текст")
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled()
    fireEvent.change(input, { target: { value: " Планові роботи " } })
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled()
    fireEvent.change(input, { target: { value: "Перша зміна" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    fireEvent.change(input, { target: { value: "Наступна зміна" } })
    resolve({ ...banner, Text: "Перша зміна" })
    await waitFor(() => expect(screen.getByLabelText("Текст")).toHaveValue("Наступна зміна"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Зберегти" })).toBeEnabled())
    fireEvent.change(screen.getByLabelText("Текст"), { target: { value: "Перша зміна" } })
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled()
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

  it("associates required text with its field before preview and never sends an invalid banner", async () => {
    render(<BannersAdmin />)
    fireEvent.click(await screen.findByRole("button", { name: "Створити банер" }))
    const input = screen.getByLabelText("Текст")
    expect(input).not.toHaveAttribute("aria-invalid", "true")
    fireEvent.blur(input)
    expect(input).toHaveAttribute("aria-invalid", "true")
    const message = document.getElementById(input.getAttribute("aria-describedby")!)!
    expect(message).toHaveTextContent("Вкажіть текст банера.")
    expect(input.parentElement).toContainElement(message)
    expect(message.compareDocumentPosition(screen.getByTestId("banner-preview")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    expect(api.create).not.toHaveBeenCalled()
  })

  it("keeps generic backend validation form-wide without blaming an arbitrary field", async () => {
    api.create.mockRejectedValueOnce(new ApiError(400, {}, undefined, undefined, 20224))
    render(<BannersAdmin />)
    fireEvent.click(await screen.findByRole("button", { name: "Створити банер" }))
    const input = screen.getByLabelText("Текст")
    fireEvent.change(input, { target: { value: "Текст" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    const message = await screen.findByRole("alert")
    expect(input.parentElement).not.toContainElement(message)
    expect(input).not.toHaveAttribute("aria-invalid", "true")
  })

  it("places the backend text-required message at the text control and clears it on edit", async () => {
    api.create.mockRejectedValueOnce(new ApiError(400, { Status: { Message: "Banner text is required" } }, undefined, undefined, 20224))
    render(<BannersAdmin />)
    fireEvent.click(await screen.findByRole("button", { name: "Створити банер" }))
    const text = screen.getByLabelText("Текст")
    fireEvent.change(text, { target: { value: "Текст" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    const error = await screen.findByText("Вкажіть текст банера.")
    expect(text).toHaveAttribute("aria-describedby", error.id)
    expect(text.parentElement).toContainElement(error)
    expect(screen.getAllByRole("alert")).toHaveLength(1)
    fireEvent.change(text, { target: { value: "Оновлено" } })
    expect(screen.queryByText("Вкажіть текст банера.")).not.toBeInTheDocument()
  })

  it("keeps simultaneous text and link errors beside their own fields", async () => {
    render(<BannersAdmin />)
    fireEvent.click(await screen.findByRole("button", { name: "Створити банер" }))
    const text = screen.getByLabelText("Текст")
    const link = screen.getByLabelText("Посилання")
    fireEvent.blur(text)
    fireEvent.change(link, { target: { value: "javascript:1" } })
    for (const control of [text, link]) {
      expect(control).toHaveAttribute("aria-invalid", "true")
      expect(control.parentElement).toContainElement(document.getElementById(control.getAttribute("aria-describedby")!))
    }
    expect(screen.getAllByRole("alert")).toHaveLength(2)
    expect(api.create).not.toHaveBeenCalled()
  })

  it("uses icon actions and the requested target names without a separate event heading", async () => {
    render(<BannersAdmin />)
    const edit = await screen.findByRole("button", { name: "Редагувати" })
    for (const name of ["Редагувати", "Вимкнути", "Видалити"]) {
      const button = screen.getByRole("button", { name })
      expect(button).toHaveTextContent("")
      expect(button.querySelector("svg")).toHaveAttribute("stroke-width", "2")
    }
    fireEvent.click(edit)
    fireEvent.click(screen.getByRole("radio", { name: "На обраних сайтах" }))
    for (const name of ["Головний сайт", "Сайт облікового запису", "Панель платформи", "Каталог завдань", "Сайти заходів"]) expect(screen.getByRole("checkbox", { name })).toBeInTheDocument()
    expect(screen.queryByText("Окремі заходи", { exact: true })).not.toBeInTheDocument()
    expect(screen.getByRole("searchbox", { name: "Пошук заходів" })).toBeInTheDocument()
  })

  it("deactivates a banner", async () => {
    render(<BannersAdmin />)
    await screen.findByText("Планові роботи")
    fireEvent.click(screen.getByRole("button", { name: "Вимкнути" }))
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("b1", expect.objectContaining({ IsActive: false, Text: "Планові роботи" })))
  })

  it("flips the state at once and keeps other rows' buttons enabled while the save is pending", async () => {
    api.list.mockResolvedValue([banner, { ...banner, ID: "b2", Text: "Друга" }])
    let finish: () => void = () => {}
    api.update.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    render(<BannersAdmin />)
    await screen.findByText("Друга")
    fireEvent.click(screen.getAllByRole("button", { name: "Вимкнути" })[0])
    expect(screen.getAllByRole("button", { name: "Вимкнути" })).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Увімкнути" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Вимкнути" })).toBeEnabled()
    finish()
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1))
  })

  it("rolls back and shows the error when the toggle fails", async () => {
    api.update.mockRejectedValueOnce(new Error("nope"))
    render(<BannersAdmin />)
    await screen.findByText("Планові роботи")
    fireEvent.click(screen.getByRole("button", { name: "Вимкнути" }))
    expect(screen.getByRole("button", { name: "Увімкнути" })).toBeInTheDocument()
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Вимкнути" })).toBeInTheDocument())
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
  it("requires a target in selected mode, preserves draft selections across modes, and clears all-mode payload", async () => {
    render(<BannersAdmin />)
    fireEvent.click(await screen.findByRole("button", { name: "Створити банер" }))
    fireEvent.change(screen.getByLabelText("Текст"), { target: { value: "Текст" } })
    fireEvent.click(screen.getByRole("radio", { name: "На обраних сайтах" }))
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled()
    expect(screen.getByText("Оберіть хоча б один сайт або захід.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox", { name: "Головний сайт" }))
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeEnabled()
    fireEvent.click(screen.getByRole("radio", { name: "На всіх сайтах" }))
    fireEvent.click(screen.getByRole("radio", { name: "На обраних сайтах" }))
    expect(screen.getByRole("checkbox", { name: "Головний сайт" })).toBeChecked()
    fireEvent.click(screen.getByRole("radio", { name: "На всіх сайтах" }))
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ TargetMode: "all", TargetSites: [], TargetEventIDs: [] })))
  })

  it("roundtrips existing service and event targets, searches all event pages, and retains selected events", async () => {
    const scoped = { ...banner, TargetMode: "selected", TargetSites: ["id"], TargetEventIDs: ["event-1"] }
    api.list.mockResolvedValue([scoped])
    api.update.mockImplementation((_id, input) => Promise.resolve({ ...scoped, ...input }))
    api.events.mockImplementation((filter) => Promise.resolve({ Items: filter.search ? [{ ID: "event-2", Name: "Осінній CTF" }] : [], Total: filter.search ? 51 : 0 }))
    render(<BannersAdmin />)
    fireEvent.click(await screen.findByRole("button", { name: "Редагувати" }))
    expect(screen.getByRole("radio", { name: "На обраних сайтах" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Сайт облікового запису" })).toBeChecked()
    expect(await screen.findByRole("button", { name: "Прибрати захід Зимовий CTF" })).toBeInTheDocument()
    fireEvent.change(screen.getByRole("searchbox", { name: "Пошук заходів" }), { target: { value: "Осінній" } })
    fireEvent.click(await screen.findByRole("checkbox", { name: "Осінній CTF" }))
    fireEvent.click(screen.getByRole("button", { name: "Далі" }))
    await waitFor(() => expect(api.events).toHaveBeenCalledWith(expect.objectContaining({ search: "Осінній", page: 2 })))
    expect(screen.getByRole("button", { name: "Прибрати захід Зимовий CTF" })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Текст"), { target: { value: "Оновлений банер" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("b1", expect.objectContaining({ TargetMode: "selected", TargetSites: ["id"], TargetEventIDs: ["event-1", "event-2"] })))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Редагувати" }))
    expect(await screen.findByRole("button", { name: "Прибрати захід Зимовий CTF" })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Сайт облікового запису" })).toBeChecked()
  })

  it("keeps selected targets when toggling activation", async () => {
    api.list.mockResolvedValue([{ ...banner, TargetMode: "selected", TargetSites: ["event"], TargetEventIDs: ["event-1"] }])
    render(<BannersAdmin />)
    fireEvent.click(await screen.findByRole("button", { name: "Вимкнути" }))
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("b1", expect.objectContaining({ IsActive: false, TargetMode: "selected", TargetSites: ["event"], TargetEventIDs: ["event-1"] })))
  })

})

describe("banner state", () => {
  const now = Date.parse("2026-10-19T12:00:00Z")
  it("says ended for a switched-on banner past its window and scheduled before it", () => {
    expect(bannerState({ IsActive: true, ActiveFrom: "2026-10-01T00:00:00Z", ActiveTo: "2026-10-10T00:00:00Z" }, now)).toBe("ended")
    expect(bannerState({ IsActive: true, ActiveFrom: "2026-10-25T00:00:00Z", ActiveTo: null }, now)).toBe("scheduled")
    expect(bannerState({ IsActive: true, ActiveFrom: null, ActiveTo: null }, now)).toBe("active")
    expect(bannerState({ IsActive: false, ActiveFrom: null, ActiveTo: "2026-10-10T00:00:00Z" }, now)).toBe("inactive")
  })
})
