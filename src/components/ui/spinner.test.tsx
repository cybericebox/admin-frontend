/**
 * spinner.test.tsx — the ice-cube Spinner renders an accessible status,
 * honors size, and PageLoader wraps a large one.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Spinner, PageLoader } from "./spinner"

describe("Spinner", () => {
  it("renders a status role containing an svg", () => {
    const { container } = render(<Spinner />)
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(container.querySelector("svg")).toBeInTheDocument()
  })

  it("defaults to the sm size class", () => {
    render(<Spinner />)
    expect(screen.getByRole("status").className).toContain("ice-loader-sm")
  })

  it("applies the requested size class", () => {
    render(<Spinner size="lg" />)
    expect(screen.getByRole("status").className).toContain("ice-loader-lg")
  })

  it("exposes label as sr-only text (and no aria-label when labelled)", () => {
    render(<Spinner label="Loading exercises" />)
    const status = screen.getByRole("status")
    expect(status).not.toHaveAttribute("aria-label")
    expect(screen.getByText("Loading exercises")).toHaveClass("sr-only")
  })

  it("falls back to aria-label when no label is given", () => {
    render(<Spinner />)
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "loading")
  })

  it("merges a caller className", () => {
    render(<Spinner className="text-white" />)
    expect(screen.getByRole("status").className).toContain("text-white")
  })
})

describe("PageLoader", () => {
  it("renders a large centered spinner", () => {
    const { container } = render(<PageLoader label="Loading" />)
    expect(screen.getByRole("status").className).toContain("ice-loader-lg")
    expect(container.querySelector(".fixed.inset-0")).toBeInTheDocument()
  })
})
