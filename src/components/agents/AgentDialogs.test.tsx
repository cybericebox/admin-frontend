import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { EnrollDialog } from "./AgentDialogs"
import { enrollAgent } from "@/api/agents"

vi.mock("@/api/agents", () => ({ enrollAgent: vi.fn(), reconnectAgent: vi.fn(), updateAgent: vi.fn() }))

it("validates every invalid enrollment field beside that control before contacting the API", () => {
  render(<EnrollDialog onClose={() => {}} onDone={() => {}} />)
  const form = document.querySelector("form")!
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  fireEvent.submit(form)
  for (const id of ["agent-name", "agent-endpoint", "agent-token"]) {
    const control = document.getElementById(id)!
    const group = control.closest('[role="group"]')!
    expect(group).toHaveAttribute("aria-invalid", "true")
    expect(group).toContainElement(document.getElementById(group.getAttribute("aria-describedby")!))
  }
  expect(screen.getAllByRole("alert")).toHaveLength(3)
  expect(enrollAgent).not.toHaveBeenCalled()
  fireEvent.change(document.getElementById("agent-name")!, { target: { value: "Cluster" } })
  expect(screen.getAllByRole("alert")).toHaveLength(2)
})
