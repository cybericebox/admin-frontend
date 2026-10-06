import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TablePagination } from "./table-pagination"

describe("TablePagination", () => {
  it("sits right under the table: it is never pushed to the bottom of the block", () => {
    const { container } = render(<TablePagination page={2} pageSize={25} total={80} onPage={vi.fn()} onPageSize={vi.fn()} />)
    expect(container.firstElementChild).not.toHaveClass("mt-auto")
    expect(screen.getByRole("button", { name: "Назад" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Далі" })).toBeEnabled()
  })
})
