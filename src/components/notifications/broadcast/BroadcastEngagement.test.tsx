import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { BroadcastEngagement } from "./BroadcastEngagement"

describe("broadcast engagement", () => {
  it("shows the approximate open share and the clicks", () => {
    render(<BroadcastEngagement broadcast={{ TrackedCount: 100, OpenedCount: 42, ClickedCount: 7 }} />)
    expect(screen.getByText("Відкрито 42 % (приблизно)")).toBeInTheDocument()
    expect(screen.getByText("Переходи 7")).toBeInTheDocument()
  })

  it("renders nothing without tracked emails", () => {
    const { container } = render(<BroadcastEngagement broadcast={{ TrackedCount: 0, OpenedCount: 0, ClickedCount: 0 }} />)
    expect(container).toBeEmptyDOMElement()
    const old = render(<BroadcastEngagement broadcast={{}} />)
    expect(old.container).toBeEmptyDOMElement()
  })
})
