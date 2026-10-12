import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { UserPicker, type PickedUser } from "./UserPicker"

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("@/api/client", () => ({ apiGet: api.get }))
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))

const users = [
  { ID: "one", FirstName: "First", LastName: "User", Email: "same@example.test" },
  { ID: "two", FirstName: "Second", LastName: "User", Email: "same@example.test" },
  { ID: "three", FirstName: "Third", LastName: "User", Email: "third@example.test" },
]

beforeEach(() => { api.get.mockReset().mockResolvedValue({ Items: users }) })
afterEach(cleanup)

function Picker({ selection = "user", maxSelected }: { selection?: "user" | "email"; maxSelected?: number }) {
  const [value, setValue] = useState<PickedUser[]>([])
  return <UserPicker value={value} onChange={setValue} selection={selection} maxSelected={maxSelected} />
}

describe("user picker selection", () => {
  it("retains selection by user ID for broadcasts when two users share an address", async () => {
    render(<Picker />)
    fireEvent.click(await screen.findByRole("checkbox", { name: /First User/ }))
    fireEvent.click(screen.getByRole("checkbox", { name: /Second User/ }))
    expect(screen.getByRole("checkbox", { name: /First User/ })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Second User/ })).toBeChecked()
    expect(screen.getByRole("list", { name: "admin.notif.broadcast.users.selected" }).children).toHaveLength(2)
  })

  it("limits unique email recipients while retaining removal at the limit", async () => {
    render(<Picker selection="email" maxSelected={1} />)
    fireEvent.click(await screen.findByRole("checkbox", { name: /First User/ }))
    expect(screen.getByRole("checkbox", { name: /Second User/ })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Second User/ })).toBeEnabled()
    expect(screen.getByRole("checkbox", { name: /Third User/ })).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: /Second User/ }))
    expect(screen.getByRole("checkbox", { name: /First User/ })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Third User/ })).toBeEnabled()
  })
})
