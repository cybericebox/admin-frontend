import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Button } from "./button"
import { SaveButton } from "./save-button"

describe("Button busy", () => {
  it("names the running operation instead of the action, with the crest, and is disabled", () => {
    const { container, rerender } = render(<Button busy={false} busyLabel="Saving…"><svg data-testid="icon" />Save</Button>)
    const idle = screen.getByRole("button", { name: "Save" })
    expect(idle).toBeEnabled()
    expect(container.querySelector(".crest-loader")).not.toBeInTheDocument()

    rerender(<Button busy busyLabel="Saving…"><svg data-testid="icon" />Save</Button>)
    const busy = screen.getByRole("button", { name: "Saving…" })
    expect(busy).toBe(idle)
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute("aria-busy", "true")
    expect(container.querySelector(".crest-loader")).toBeInTheDocument()
    // The idle face stays in place, hidden, so the button keeps its width.
    expect(screen.getByTestId("icon").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true")
  })

  it("keeps the busy label in the button before the work starts, so the width never jumps", () => {
    render(<Button busy={false} busyLabel="Sending…">Send</Button>)
    const button = screen.getByRole("button", { name: "Send" })
    expect(button.textContent).toContain("Sending…")
  })

  it("renders no loader when idle", () => {
    const { container } = render(<Button>Save</Button>)
    expect(screen.getByRole("button")).toBeEnabled()
    expect(container.querySelector(".crest-loader")).not.toBeInTheDocument()
  })

  it("SaveButton says 'Saving' while saving", () => {
    render(<SaveButton dirty busy>admin.common.save</SaveButton>)
    expect(screen.getByRole("button", { name: "Зберігаємо…" })).toBeDisabled()
  })
})
