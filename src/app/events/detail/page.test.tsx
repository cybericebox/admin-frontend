import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import Page from "./page"

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("id=event-1") }))
vi.mock("@/components/events/EventAdminDetail", () => ({ EventAdminDetail: ({ id }: { id: string }) => <div>event-detail:{id}</div> }))

describe("event detail route", () => {
  it("opens the platform event record", () => {
    render(<Page />)
    expect(screen.getByText("event-detail:event-1")).toBeInTheDocument()
  })
})
