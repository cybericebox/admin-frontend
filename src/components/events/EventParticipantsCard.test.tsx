import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { EventParticipantsCard } from "./EventParticipantsCard"

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock("@/api/client", () => ({ apiGet: mocks.get, apiPost: mocks.post }))

describe("EventParticipantsCard", () => {
  beforeEach(() => {
    mocks.get.mockReset().mockImplementation((path: string) => {
      if (path.startsWith("/api/events/event-1/participants?")) return Promise.resolve({
        Items: [{ UserID: "user-1", Status: 1, CreatedAt: "2026-09-24T09:00:00Z", DecidedAt: null }],
        NextCursor: "", HasMore: false, Total: 1,
      })
      if (path === "/api/users/user-1") return Promise.resolve({ ID: "user-1", FirstName: "Марія", LastName: "Савчук", Email: "maria@example.com" })
      return Promise.reject(new Error(path))
    })
    mocks.post.mockReset().mockResolvedValue(undefined)
  })

  it("shows pending participants and approves through the event API", async () => {
    render(<EventParticipantsCard eventID="event-1" editable />)
    expect(await screen.findByText("Марія Савчук")).toBeInTheDocument()
    expect(screen.getByText("Очікує рішення")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Підтвердити Марія Савчук" }))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("/api/events/event-1/participants/user-1/approve", {}))
    expect(await screen.findByText("Підтверджено")).toBeInTheDocument()
  })

  it("shows invitations as awaiting the invited person without decision buttons", async () => {
    mocks.get.mockImplementation((path: string) => {
      if (path.startsWith("/api/events/event-1/participants?")) return Promise.resolve({
        Items: [{ UserID: "user-1", Status: 1, CreatedAt: "2026-09-24T09:00:00Z", DecidedAt: null, Invited: true, InvitedTeamName: "Blue" }],
        NextCursor: "",
      })
      if (path === "/api/users/user-1") return Promise.resolve({ ID: "user-1", FirstName: "Марія", LastName: "Савчук", Email: "maria@example.com" })
      return Promise.reject(new Error(path))
    })
    render(<EventParticipantsCard eventID="event-1" editable />)
    expect(await screen.findByText("Марія Савчук")).toBeInTheDocument()
    expect(screen.getByText("Запрошено до «Blue» · очікує відповіді")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Підтвердити/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Відхилити/ })).not.toBeInTheDocument()
  })

  it("keeps participant decisions read-only without event write permission", async () => {
    render(<EventParticipantsCard eventID="event-1" editable={false} />)
    expect(await screen.findByText("Марія Савчук")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Підтвердити/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Відхилити/ })).not.toBeInTheDocument()
  })

  it("filters by pending status using the backend status code", async () => {
    render(<EventParticipantsCard eventID="event-1" editable />)
    await screen.findByText("Марія Савчук")
    fireEvent.keyDown(screen.getByRole("button", { name: "Фільтр учасників" }), { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Очікують рішення" }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/api/events/event-1/participants?pageSize=20&status=1"))
  })

  it("confirms rejection before sending the decision", async () => {
    render(<EventParticipantsCard eventID="event-1" editable />)
    fireEvent.click(await screen.findByRole("button", { name: "Відхилити Марія Савчук" }))
    expect(mocks.post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Відхилити заявку" }))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("/api/events/event-1/participants/user-1/reject", {}))
    expect(screen.getByText("Відхилено")).toBeInTheDocument()
  })

  it("loads another cursor page without discarding the first", async () => {
    mocks.get.mockImplementation((path: string) => {
      if (path.includes("cursor=next")) return Promise.resolve({ Items: [{ UserID: "user-2", Status: 2, CreatedAt: "2026-09-24T10:00:00Z", DecidedAt: "2026-09-24T10:01:00Z" }], NextCursor: "" })
      if (path.includes("/participants?")) return Promise.resolve({ Items: [{ UserID: "user-1", Status: 1, CreatedAt: "2026-09-24T09:00:00Z", DecidedAt: null }], NextCursor: "next" })
      if (path === "/api/users/user-1") return Promise.resolve({ ID: "user-1", FirstName: "Марія", LastName: "Савчук", Email: "maria@example.com" })
      if (path === "/api/users/user-2") return Promise.resolve({ ID: "user-2", FirstName: "Тарас", LastName: "Лев", Email: "taras@example.com" })
      return Promise.reject(new Error(path))
    })
    render(<EventParticipantsCard eventID="event-1" editable />)
    fireEvent.click(await screen.findByRole("button", { name: "Показати ще" }))
    expect(await screen.findByText("Тарас Лев")).toBeInTheDocument()
    expect(screen.getByText("Марія Савчук")).toBeInTheDocument()
    expect(mocks.get).toHaveBeenCalledWith("/api/events/event-1/participants?pageSize=20&cursor=next")
  })

  it("disables only the row being decided, not the other rows", async () => {
    mocks.get.mockImplementation((path: string) => {
      if (path.includes("/participants?")) return Promise.resolve({ Items: [
        { UserID: "user-1", Status: 1, CreatedAt: "2026-09-24T09:00:00Z", DecidedAt: null },
        { UserID: "user-2", Status: 1, CreatedAt: "2026-09-24T09:05:00Z", DecidedAt: null },
      ], NextCursor: "" })
      if (path === "/api/users/user-1") return Promise.resolve({ ID: "user-1", FirstName: "Марія", LastName: "Савчук", Email: "maria@example.com" })
      if (path === "/api/users/user-2") return Promise.resolve({ ID: "user-2", FirstName: "Тарас", LastName: "Лев", Email: "taras@example.com" })
      return Promise.reject(new Error(path))
    })
    mocks.post.mockReturnValueOnce(new Promise(() => {}))
    render(<EventParticipantsCard eventID="event-1" editable />)
    fireEvent.click(await screen.findByRole("button", { name: "Підтвердити Марія Савчук" }))
    expect(screen.getByRole("button", { name: "Підтвердити Марія Савчук" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Підтвердити Тарас Лев" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Відхилити Тарас Лев" })).toBeEnabled()
  })
})
