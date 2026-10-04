import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { KpiTile } from "./KpiTile"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

describe("KpiTile", () => {
  it("shows label, value, delta and sub-line", () => {
    render(<KpiTile label="Users" value={1234} delta={{ text: "+5%", tone: "up" }} sub="vs last period" />)
    expect(screen.getByText("Users")).toBeInTheDocument()
    expect(screen.getByText("1234")).toHaveClass("tabular-nums")
    expect(screen.getByText("+5%")).toBeInTheDocument()
  })
  it("shows the crest while loading and a dash when empty", () => {
    const { rerender } = render(<KpiTile label="Users" loading />)
    expect(screen.getByRole("status")).toBeInTheDocument()
    rerender(<KpiTile label="Users" empty />)
    expect(screen.getByText("–")).toBeInTheDocument()
  })
  it("links the whole tile to its section", () => {
    render(<KpiTile label="Users" value={1} href="/analytics/users" hint="What is counted" />)
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/analytics/users")
    expect(screen.getByRole("button", { name: "What is counted" })).toBeInTheDocument()
  })
})
