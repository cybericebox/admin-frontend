import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { EngagementLine, LinksList, clicksText, openedText } from "./EngagementLine"

describe("journal engagement", () => {
  it("shows the first open time and the click count of a tracked email, with the approximate marker", () => {
    render(<EngagementLine target={{ Channel: "email", Tracked: true, FirstOpenedAt: "2026-09-29T10:00:00Z", OpenCount: 2, ClickCount: 3 }} />)
    expect(screen.getByText(/Відкрито \(приблизно\)/)).toBeInTheDocument()
    expect(screen.getByText(/Переходи/)).toHaveTextContent("Переходи: 3")
  })

  it("says not opened for a tracked email nobody opened", () => {
    render(<EngagementLine target={{ Channel: "email", Tracked: true, FirstOpenedAt: null, ClickCount: 0 }} />)
    expect(screen.getByText("Не відкрито")).toBeInTheDocument()
  })

  it("shows a dash, not zero, for an untracked email", () => {
    const target = { Channel: "email", Tracked: false, OpenCount: 0, ClickCount: 0 }
    expect(openedText(target)).toBe("—")
    expect(clicksText(target)).toBe("—")
    render(<EngagementLine target={target} />)
    expect(screen.getByText(/Переходи/)).toHaveTextContent("Переходи: —")
  })

  it("treats a payload without the new fields as untracked and hides other channels", () => {
    expect(clicksText({ Channel: "email" })).toBe("—")
    const { container } = render(<EngagementLine target={{ Channel: "in_app", Tracked: true }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("lists followed links with their counts and skips unclicked ones", () => {
    render(<LinksList links={[{ Index: 0, Label: "example.com/join", ClickCount: 4 }, { Index: 1, Label: "example.com/unused", ClickCount: 0 }]} />)
    expect(screen.getByText("example.com/join")).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.queryByText("example.com/unused")).not.toBeInTheDocument()
  })

  it("renders no links block when nothing was followed", () => {
    const { container } = render(<LinksList links={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
