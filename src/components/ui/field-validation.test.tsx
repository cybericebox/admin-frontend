import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { FieldValidation } from "./field-validation"

it("associates each field group with its own adjacent error and preserves existing control help", () => {
  render(<>
    <FieldValidation error="Name required" label="Name"><input aria-label="Name" aria-describedby="name-help" /><p id="name-help">Existing help</p></FieldValidation>
    <FieldValidation error="Invalid date" label="Date"><button aria-label="Date">Date</button></FieldValidation>
  </>)
  for (const [name, message] of [["Name", "Name required"], ["Date", "Invalid date"]]) {
    const control = screen.getByLabelText(name)
    const group = control.closest('[role="group"]')!
    const error = screen.getByText(message)
    expect(group).toHaveAttribute("aria-invalid", "true")
    expect(group).toHaveAttribute("aria-describedby", error.id)
    expect(group).toContainElement(error)
  }
  expect(screen.getByLabelText("Name")).toHaveAttribute("aria-describedby", "name-help")
})
