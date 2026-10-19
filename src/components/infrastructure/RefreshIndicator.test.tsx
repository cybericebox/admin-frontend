import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { RefreshIndicator } from "./RefreshIndicator"

describe("RefreshIndicator", () => {
  it("says «щойно» right after a refresh instead of «0 с тому»", () => {
    render(<RefreshIndicator updatedAt={Date.now()} refreshing={false} />)
    expect(screen.getByText("Оновлено щойно")).toBeInTheDocument()
  })

  it("counts seconds once a few have passed", () => {
    render(<RefreshIndicator updatedAt={Date.now() - 12_000} refreshing={false} />)
    expect(screen.getByText(/Оновлено 1[2-3] с тому/)).toBeInTheDocument()
  })
})
