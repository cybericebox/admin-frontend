import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { EventManagersCard } from "./EventManagersCard"

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }))
vi.mock("@/api/client", () => ({ apiGet: mocks.get, apiPost: mocks.post, apiPut: mocks.put, apiDelete: mocks.del }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

const managers = [
  { UserID: "owner-1", Role: 0, CreatedAt: "2026-09-01T09:00:00Z" },
  { UserID: "viewer-1", Role: 2, CreatedAt: "2026-09-02T09:00:00Z" },
]

describe("EventManagersCard", () => {
  beforeEach(() => {
    mocks.get.mockReset().mockImplementation((path: string) => {
      if (path === "/api/users/owner-1") return Promise.resolve({ ID: "owner-1", FirstName: "Олена", LastName: "Коваль", Email: "owner@example.com" })
      if (path === "/api/users/viewer-1") return Promise.resolve({ ID: "viewer-1", FirstName: "Іван", LastName: "Петренко", Email: "viewer@example.com" })
      if (path.startsWith("/api/users?")) return Promise.resolve({ Items: [{ ID: "new-1", FirstName: "Марія", LastName: "Савчук", Email: "maria@example.com" }], NextCursor: "" })
      return Promise.reject(new Error(path))
    })
    mocks.put.mockReset().mockImplementation((_path: string, body: { Role: number }) => Promise.resolve({ UserID: "viewer-1", Role: body.Role, CreatedAt: managers[1].CreatedAt }))
    mocks.post.mockReset()
    mocks.del.mockReset().mockResolvedValue(undefined)
  })

  it("shows people and protects the owner from edits", async () => {
    render(<EventManagersCard eventID="event-1" managers={managers} editable onChanged={vi.fn()} />)
    expect(await screen.findByText("Олена Коваль")).toBeInTheDocument()
    expect(screen.getByText("Іван Петренко")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Змінити роль Олена Коваль" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Вилучити Олена Коваль" })).not.toBeInTheDocument()
  })

  it("changes a non-owner role through the event API", async () => {
    const onChanged = vi.fn()
    render(<EventManagersCard eventID="event-1" managers={managers} editable onChanged={onChanged} />)
    const role = await screen.findByRole("button", { name: "Змінити роль Іван Петренко" })
    fireEvent.keyDown(role, { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Модератор" }))
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith("/api/events/event-1/managers/viewer-1", { Role: 1 }))
    expect(onChanged).toHaveBeenCalledWith({ UserID: "viewer-1", Role: 1, CreatedAt: managers[1].CreatedAt })
  })

  it("keeps a read-only manager list without mutation controls", async () => {
    render(<EventManagersCard eventID="event-1" managers={managers} editable={false} onChanged={vi.fn()} />)
    expect(await screen.findByText("Іван Петренко")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Додати модератора/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Змінити роль/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Вилучити/ })).not.toBeInTheDocument()
  })

  it("adds a user selected from search", async () => {
    const onChanged = vi.fn()
    mocks.put.mockResolvedValueOnce({ UserID: "new-1", Role: 1, CreatedAt: "2026-09-24T09:00:00Z" })
    render(<EventManagersCard eventID="event-1" managers={managers} editable onChanged={onChanged} />)
    fireEvent.click(screen.getByRole("button", { name: "Додати модератора" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Користувач" }), { target: { value: "maria" } })
    fireEvent.click(await screen.findByRole("button", { name: /Марія Савчук/ }))
    fireEvent.click(screen.getByRole("button", { name: "Надати доступ" }))
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith("/api/events/event-1/managers/new-1", { Role: 1 }))
    expect(onChanged).toHaveBeenCalledWith({ UserID: "new-1", Role: 1, CreatedAt: "2026-09-24T09:00:00Z" })
  })

  it("asks for confirmation before removing a manager", async () => {
    const onRemoved = vi.fn()
    render(<EventManagersCard eventID="event-1" managers={managers} editable onChanged={vi.fn()} onRemoved={onRemoved} />)
    fireEvent.click(await screen.findByRole("button", { name: "Вилучити Іван Петренко" }))
    expect(mocks.del).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Вилучити доступ" }))
    await waitFor(() => expect(mocks.del).toHaveBeenCalledWith("/api/events/event-1/managers/viewer-1"))
    expect(onRemoved).toHaveBeenCalledWith("viewer-1")
  })

  it("invites an unknown email as a platform user and adds it as a moderator", async () => {
    const onChanged = vi.fn()
    mocks.get.mockImplementation((path: string) => {
      if (path.startsWith("/api/users?")) return Promise.resolve(mocks.post.mock.calls.length
        ? { Items: [{ ID: "invited-1", FirstName: "", LastName: "", Email: "new@example.com" }] }
        : { Items: [] })
      return Promise.reject(new Error(path))
    })
    mocks.post.mockResolvedValue([{ Email: "new@example.com" }])
    mocks.put.mockResolvedValue({ UserID: "invited-1", Role: 1, CreatedAt: "2026-09-24T09:00:00Z" })
    render(<EventManagersCard eventID="event-1" managers={[]} editable onChanged={onChanged} />)
    fireEvent.click(screen.getByRole("button", { name: "Додати модератора" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Користувач" }), { target: { value: "new@example.com" } })
    fireEvent.click(await screen.findByRole("button", { name: "Запросити й додати" }))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("/api/users/invite", { Emails: ["new@example.com"], Role: "user" }))
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith("/api/events/event-1/managers/invited-1", { Role: 1 }))
    expect(onChanged).toHaveBeenCalledWith({ UserID: "invited-1", Role: 1, CreatedAt: "2026-09-24T09:00:00Z" })
  })

  it("shows the chosen role before the server answers and keeps other controls enabled", async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.put.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    render(<EventManagersCard eventID="event-1" managers={managers} editable onChanged={vi.fn()} />)
    const role = await screen.findByRole("button", { name: "Змінити роль Іван Петренко" })
    fireEvent.keyDown(role, { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Модератор" }))
    expect(screen.getByRole("button", { name: "Змінити роль Іван Петренко" })).toHaveTextContent("Модератор")
    expect(screen.getByRole("button", { name: "Змінити роль Іван Петренко" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Вилучити Іван Петренко" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Додати модератора" })).toBeEnabled()
    finish({ UserID: "viewer-1", Role: 1, CreatedAt: managers[1].CreatedAt })
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1))
  })

  it("rolls the role back when the save fails", async () => {
    mocks.put.mockRejectedValueOnce(new Error("nope"))
    render(<EventManagersCard eventID="event-1" managers={managers} editable onChanged={vi.fn()} />)
    const role = await screen.findByRole("button", { name: "Змінити роль Іван Петренко" })
    const before = role.textContent
    fireEvent.keyDown(role, { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Модератор" }))
    expect(screen.getByRole("button", { name: "Змінити роль Іван Петренко" })).toHaveTextContent("Модератор")
    await waitFor(() => expect(screen.getByRole("button", { name: "Змінити роль Іван Петренко" })).toHaveTextContent(before ?? ""))
  })
})
