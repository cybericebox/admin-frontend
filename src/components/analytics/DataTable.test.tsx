import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { DataTable, type Column } from "./DataTable"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

type Row = { id: string; name: string; n: number }
const columns: Column<Row>[] = [
  { key: "name", header: "Name", cell: (r) => r.name, sortValue: (r) => r.name },
  { key: "n", header: "Count", cell: (r) => r.n, sortValue: (r) => r.n, numeric: true },
]
const rows: Row[] = [{ id: "a", name: "b", n: 2 }, { id: "b", name: "a", n: 10 }, { id: "c", name: "c", n: 1 }]
const names = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.textContent)

describe("DataTable", () => {
  it("sorts by a header, toggling direction", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} ariaLabel="t" />)
    fireEvent.click(screen.getByRole("button", { name: "Count" }))
    expect(names()).toEqual(["a10", "b2", "c1"].sort((x, y) => Number(x.slice(1)) - Number(y.slice(1))))
    fireEvent.click(screen.getByRole("button", { name: "Count" }))
    expect(names()).toEqual(["a10", "b2", "c1"])
  })
  it("links rows through the first cell", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/x/${r.id}`} ariaLabel="t" />)
    expect(screen.getByRole("link", { name: "a" })).toHaveAttribute("href", "/x/b")
  })
  it("centres loading, error and empty in a block of constant min height", () => {
    const { container, rerender } = render(<DataTable columns={columns} rows={undefined} rowKey={(r) => r.id} ariaLabel="t" loading minHeight={280} />)
    const block = container.firstChild as HTMLElement
    expect(block.style.minHeight).toBe("280px")
    expect(screen.getByRole("status")).toBeInTheDocument()
    // the header stays in every state
    expect(screen.getByRole("columnheader", { name: "Count" })).toBeInTheDocument()
    const onRetry = vi.fn()
    rerender(<DataTable columns={columns} rows={undefined} rowKey={(r) => r.id} ariaLabel="t" error={new Error("x")} onRetry={onRetry} minHeight={280} />)
    fireEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }))
    expect(onRetry).toHaveBeenCalledOnce()
    rerender(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} ariaLabel="t" minHeight={280} />)
    expect(container.querySelector("[data-empty-state]")).not.toBeNull()
    expect((container.firstChild as HTMLElement).style.minHeight).toBe("280px")
  })
})
